const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { insertOne, findByKey, findById, updateOne, findAll } = require('../database');
const { sendVerificationEmail } = require('../services/email');

const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 5;
const OTP_EXPIRY_MINUTES = 10;

function requireCustomer(req, res, next) {
  if (req.session.customer) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isLockedOut(customer) {
  if (!customer.locked_until) return false;
  return new Date(customer.locked_until) > new Date();
}

function getLockoutSeconds(customer) {
  if (!customer.locked_until) return 0;
  const diff = new Date(customer.locked_until) - new Date();
  return Math.max(0, Math.ceil(diff / 1000));
}

function recordFailedAttempt(customer) {
  const attempts = (customer.failed_attempts || 0) + 1;
  const updates = { failed_attempts: attempts };
  if (attempts >= LOCKOUT_ATTEMPTS) {
    const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    updates.locked_until = lockUntil.toISOString();
  }
  updateOne('customers', { id: customer.id }, updates);
  return updates;
}

function clearFailedAttempts(customer) {
  updateOne('customers', { id: customer.id }, { failed_attempts: 0, locked_until: null });
}

function findCustomerByLogin(login) {
  const trimmed = login.trim();
  let customer = findByKey('customers', { email: trimmed.toLowerCase() });
  if (customer) return customer;
  customer = findByKey('customers', { username: trimmed.toLowerCase() });
  return customer;
}

// ==================== SIGNUP ====================
router.get('/signup', (req, res) => {
  if (req.session.customer) return res.redirect('/account');
  res.render('signup', { title: 'Sign Up', error: null });
});

router.post('/signup', async (req, res) => {
  const { name, username, email, password, confirm_password, address, city, state, pincode } = req.body;

  if (!name || !username || !email || !password || !confirm_password || !address || !city || !state || !pincode) {
    return res.render('signup', { title: 'Sign Up', error: 'All fields are required', name, username, email, address, city, state, pincode });
  }
  if (!/^[A-Za-z\s]+$/.test(name.trim())) {
    return res.render('signup', { title: 'Sign Up', error: 'Name must contain only letters', name, username, email, address, city, state, pincode });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
    return res.render('signup', { title: 'Sign Up', error: 'Username must be 3-20 characters (letters, numbers, underscore)', name, username, email, address, city, state, pincode });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.render('signup', { title: 'Sign Up', error: 'Please enter a valid email address', name, username, email, address, city, state, pincode });
  }
  if (password.length < 6) {
    return res.render('signup', { title: 'Sign Up', error: 'Password must be at least 6 characters', name, username, email, address, city, state, pincode });
  }
  if (password !== confirm_password) {
    return res.render('signup', { title: 'Sign Up', error: 'Passwords do not match', name, username, email, address, city, state, pincode });
  }
  if (!/^[0-9]{6}$/.test(pincode.trim())) {
    return res.render('signup', { title: 'Sign Up', error: 'Please enter a valid 6-digit pincode', name, username, email, address, city, state, pincode });
  }

  if (findByKey('customers', { email: email.toLowerCase().trim() })) {
    return res.render('signup', { title: 'Sign Up', error: 'Email already registered', name, username, email, address, city, state, pincode });
  }
  if (findByKey('customers', { username: username.toLowerCase().trim() })) {
    return res.render('signup', { title: 'Sign Up', error: 'Username already taken', name, username, email, address, city, state, pincode });
  }

  const code = generateCode();
  const codeExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  req.session.pendingSignup = {
    name: name.trim(),
    username: username.toLowerCase().trim(),
    email: email.toLowerCase().trim(),
    password: bcrypt.hashSync(password, 10),
    address: address.trim(),
    city: city.trim(),
    state: state.trim(),
    pincode: pincode.trim(),
    code,
    codeExpiry: codeExpiry.toISOString()
  };

  await sendVerificationEmail(email.trim(), code, name.trim());

  res.render('verify-email', { title: 'Verify Email', email: email.trim(), error: null, codeSent: true });
});

// ==================== VERIFY EMAIL ====================
router.get('/verify-email', (req, res) => {
  if (!req.session.pendingSignup) return res.redirect('/signup');
  const ps = req.session.pendingSignup;
  res.render('verify-email', { title: 'Verify Email', email: ps.email, error: null, codeSent: true });
});

router.post('/verify-email', (req, res) => {
  if (!req.session.pendingSignup) return res.redirect('/signup');
  const { code } = req.body;
  const ps = req.session.pendingSignup;

  if (new Date(ps.codeExpiry) < new Date()) {
    delete req.session.pendingSignup;
    return res.render('signup', { title: 'Sign Up', error: 'Verification code expired. Please sign up again.', name: ps.name, username: ps.username, email: ps.email });
  }
  if (code.trim() !== ps.code) {
    return res.render('verify-email', { title: 'Verify Email', email: ps.email, error: 'Invalid verification code', codeSent: true });
  }

  const customer = insertOne('customers', {
    name: ps.name,
    username: ps.username,
    email: ps.email,
    phone: '',
    password: ps.password,
    email_verified: true,
    phone_verified: false,
    address: ps.address || '',
    city: ps.city || '',
    state: ps.state || '',
    pincode: ps.pincode || ''
  });

  delete req.session.pendingSignup;
  req.session.customer = { id: customer.id, name: customer.name, email: customer.email };
  const returnTo = req.session.returnTo || '/';
  delete req.session.returnTo;
  res.redirect(returnTo);
});

// ==================== LOGIN ====================
router.get('/login', (req, res) => {
  if (req.session.customer) return res.redirect('/account');
  res.render('login', { title: 'Login', error: req.query.error || null, login: null });
});

// ==================== FORGOT PASSWORD ====================
router.get('/forgot-password', (req, res) => {
  if (req.session.customer) return res.redirect('/account');
  res.render('forgot-password', { title: 'Forgot Password', error: null, success: null, email: '' });
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.render('forgot-password', { title: 'Forgot Password', error: 'Please enter a valid email address', success: null, email });
  }

  const customer = findByKey('customers', { email: email.toLowerCase().trim() });
  if (!customer) {
    return res.render('forgot-password', { title: 'Forgot Password', error: 'No account found with that email', success: null, email });
  }

  const code = generateCode();
  const codeExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  req.session.passwordReset = {
    customer_id: customer.id,
    email: customer.email,
    code,
    codeExpiry: codeExpiry.toISOString()
  };

  await sendVerificationEmail(customer.email, code, customer.name);

  res.render('reset-password', { title: 'Reset Password', email: customer.email, error: null, success: 'Verification code sent!', code });
});

router.post('/reset-password', async (req, res) => {
  const { email, code, new_password, confirm_password } = req.body;

  if (!req.session.passwordReset) {
    return res.render('forgot-password', { title: 'Forgot Password', error: 'Session expired. Please try again.', success: null, email: '' });
  }

  const pr = req.session.passwordReset;

  if (new Date(pr.codeExpiry) < new Date()) {
    delete req.session.passwordReset;
    return res.render('forgot-password', { title: 'Forgot Password', error: 'Verification code expired. Please request a new one.', success: null, email: pr.email });
  }

  if (code.trim() !== pr.code) {
    return res.render('reset-password', { title: 'Reset Password', email: pr.email, error: 'Invalid verification code', success: null, code: pr.code });
  }

  if (!new_password || new_password.length < 6) {
    return res.render('reset-password', { title: 'Reset Password', email: pr.email, error: 'Password must be at least 6 characters', success: null, code: pr.code });
  }

  if (new_password !== confirm_password) {
    return res.render('reset-password', { title: 'Reset Password', email: pr.email, error: 'Passwords do not match', success: null, code: pr.code });
  }

  updateOne('customers', { id: pr.customer_id }, {
    password: bcrypt.hashSync(new_password, 10),
    failed_attempts: 0,
    locked_until: null
  });

  delete req.session.passwordReset;

  res.render('login', { title: 'Login', error: null, login: null, successMsg: 'Password reset successfully! Please login with your new password.' });
});

router.post('/login', (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.render('login', { title: 'Login', error: 'Please fill in all fields', login });
  }

  const customer = findCustomerByLogin(login);
  if (!customer) {
    return res.render('login', { title: 'Login', error: 'No account found with that email or username', login });
  }

  if (isLockedOut(customer)) {
    const secs = getLockoutSeconds(customer);
    return res.render('login', { title: 'Login', error: `Account locked due to too many failed attempts. Try again in ${secs} seconds.`, login });
  }

  if (!bcrypt.compareSync(password, customer.password)) {
    const updates = recordFailedAttempt(customer);
    const remaining = LOCKOUT_ATTEMPTS - (updates.failed_attempts || 0);
    if (remaining <= 0) {
      return res.render('login', { title: 'Login', error: `Account locked for ${LOCKOUT_MINUTES} minutes due to too many failed attempts.`, login });
    }
    return res.render('login', { title: 'Login', error: `Wrong password. ${remaining} attempt(s) remaining before lockout.`, login });
  }

  clearFailedAttempts(customer);
  req.session.customer = { id: customer.id, name: customer.name, email: customer.email || '' };
  const returnTo = req.session.returnTo || '/';
  delete req.session.returnTo;
  res.redirect(returnTo);
});

// ==================== ACCOUNT ====================
router.get('/account', requireCustomer, (req, res) => {
  const customer = findById('customers', req.session.customer.id);
  res.render('account', { title: 'My Account', customer, success: null, error: null });
});

router.post('/account', requireCustomer, (req, res) => {
  const { name, email, phone, address, city, state, pincode, current_password, new_password } = req.body;
  const customer = findById('customers', req.session.customer.id);

  const updates = {
    name: name.trim(),
    email: email ? email.toLowerCase().trim() : customer.email,
    phone: phone ? phone.trim() : customer.phone,
    address: address || '',
    city: city || '',
    state: state || '',
    pincode: pincode || ''
  };

  if (new_password) {
    if (!current_password) {
      return res.render('account', { title: 'My Account', customer, error: 'Current password is required', success: null });
    }
    if (!bcrypt.compareSync(current_password, customer.password)) {
      return res.render('account', { title: 'My Account', customer, error: 'Current password is incorrect', success: null });
    }
    if (new_password.length < 6) {
      return res.render('account', { title: 'My Account', customer, error: 'New password must be at least 6 characters', success: null });
    }
    updates.password = bcrypt.hashSync(new_password, 10);
  }

  updateOne('customers', { id: customer.id }, updates);
  req.session.customer.name = updates.name;
  req.session.customer.email = updates.email;

  const updatedCustomer = findById('customers', customer.id);
  res.render('account', { title: 'My Account', customer: updatedCustomer, success: 'Profile updated successfully!', error: null });
});

// ==================== ORDERS ====================
router.get('/orders', requireCustomer, (req, res) => {
  const customer = findById('customers', req.session.customer.id);
  const orders = findAll('orders', { customer_id: req.session.customer.id }, { created_at: 'desc' });
  res.render('order-history', { title: 'My Orders', orders: orders.data, customer });
});

// ==================== LOGOUT ====================
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
