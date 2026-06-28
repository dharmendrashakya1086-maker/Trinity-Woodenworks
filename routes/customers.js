const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { insertOne, findByKey, findById, updateOne, findAll, getDB } = require('../database');

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
  customer = findByKey('customers', { phone: trimmed });
  if (customer) return customer;
  customer = findByKey('customers', { username: trimmed.toLowerCase() });
  return customer;
}

// ==================== SIGNUP WITH EMAIL ====================
router.get('/signup', (req, res) => {
  if (req.session.customer) return res.redirect('/account');
  res.render('signup', { title: 'Sign Up', error: null });
});

router.get('/signup/email', (req, res) => {
  if (req.session.customer) return res.redirect('/account');
  res.render('signup-email', { title: 'Sign Up with Email', error: null });
});

router.post('/signup/email', (req, res) => {
  const { name, username, email, password, confirm_password } = req.body;

  if (!name || !username || !email || !password || !confirm_password) {
    return res.render('signup-email', { title: 'Sign Up with Email', error: 'All fields are required', name, username, email });
  }
  if (!/^[A-Za-z\s]+$/.test(name.trim())) {
    return res.render('signup-email', { title: 'Sign Up with Email', error: 'Name must contain only letters', name, username, email });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
    return res.render('signup-email', { title: 'Sign Up with Email', error: 'Username must be 3-20 characters (letters, numbers, underscore)', name, username, email });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.render('signup-email', { title: 'Sign Up with Email', error: 'Please enter a valid email address', name, username, email });
  }
  if (password.length < 6) {
    return res.render('signup-email', { title: 'Sign Up with Email', error: 'Password must be at least 6 characters', name, username, email });
  }
  if (password !== confirm_password) {
    return res.render('signup-email', { title: 'Sign Up with Email', error: 'Passwords do not match', name, username, email });
  }

  if (findByKey('customers', { email: email.toLowerCase().trim() })) {
    return res.render('signup-email', { title: 'Sign Up with Email', error: 'Email already registered', name, username, email });
  }
  if (findByKey('customers', { username: username.toLowerCase().trim() })) {
    return res.render('signup-email', { title: 'Sign Up with Email', error: 'Username already taken', name, username, email });
  }

  const code = generateCode();
  const codeExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  req.session.pendingSignup = {
    type: 'email',
    name: name.trim(),
    username: username.toLowerCase().trim(),
    email: email.toLowerCase().trim(),
    password: bcrypt.hashSync(password, 10),
    code,
    codeExpiry: codeExpiry.toISOString()
  };

  res.render('verify-email', { title: 'Verify Email', email: email.trim(), code, error: null });
});

router.get('/verify-email', (req, res) => {
  if (!req.session.pendingSignup || req.session.pendingSignup.type !== 'email') {
    return res.redirect('/signup/email');
  }
  const ps = req.session.pendingSignup;
  res.render('verify-email', { title: 'Verify Email', email: ps.email, code: ps.code, error: null });
});

router.post('/verify-email', (req, res) => {
  if (!req.session.pendingSignup || req.session.pendingSignup.type !== 'email') {
    return res.redirect('/signup/email');
  }
  const { code } = req.body;
  const ps = req.session.pendingSignup;

  if (new Date(ps.codeExpiry) < new Date()) {
    delete req.session.pendingSignup;
    return res.render('signup-email', { title: 'Sign Up with Email', error: 'Verification code expired. Please sign up again.', name: ps.name, username: ps.username, email: ps.email });
  }
  if (code !== ps.code) {
    return res.render('verify-email', { title: 'Verify Email', email: ps.email, code: ps.code, error: 'Invalid verification code' });
  }

  const customer = insertOne('customers', {
    name: ps.name,
    username: ps.username,
    email: ps.email,
    phone: '',
    password: ps.password,
    email_verified: true,
    phone_verified: false,
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  delete req.session.pendingSignup;
  req.session.customer = { id: customer.id, name: customer.name, email: customer.email };
  const returnTo = req.session.returnTo || '/';
  delete req.session.returnTo;
  res.redirect(returnTo);
});

// ==================== SIGNUP WITH MOBILE ====================
router.get('/signup/mobile', (req, res) => {
  if (req.session.customer) return res.redirect('/account');
  res.render('signup-mobile', { title: 'Sign Up with Mobile', error: null });
});

router.post('/signup/mobile', (req, res) => {
  const { name, username, phone, password, confirm_password } = req.body;

  if (!name || !username || !phone || !password || !confirm_password) {
    return res.render('signup-mobile', { title: 'Sign Up with Mobile', error: 'All fields are required', name, username, phone });
  }
  if (!/^[A-Za-z\s]+$/.test(name.trim())) {
    return res.render('signup-mobile', { title: 'Sign Up with Mobile', error: 'Name must contain only letters', name, username, phone });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
    return res.render('signup-mobile', { title: 'Sign Up with Mobile', error: 'Username must be 3-20 characters (letters, numbers, underscore)', name, username, phone });
  }
  if (!/^[0-9]{10}$/.test(phone.trim())) {
    return res.render('signup-mobile', { title: 'Sign Up with Mobile', error: 'Please enter a valid 10-digit mobile number', name, username, phone });
  }
  if (password.length < 6) {
    return res.render('signup-mobile', { title: 'Sign Up with Mobile', error: 'Password must be at least 6 characters', name, username, phone });
  }
  if (password !== confirm_password) {
    return res.render('signup-mobile', { title: 'Sign Up with Mobile', error: 'Passwords do not match', name, username, phone });
  }

  if (findByKey('customers', { phone: phone.trim() })) {
    return res.render('signup-mobile', { title: 'Sign Up with Mobile', error: 'Phone number already registered', name, username, phone });
  }
  if (findByKey('customers', { username: username.toLowerCase().trim() })) {
    return res.render('signup-mobile', { title: 'Sign Up with Mobile', error: 'Username already taken', name, username, phone });
  }

  const otp = generateCode();
  const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  req.session.pendingSignup = {
    type: 'mobile',
    name: name.trim(),
    username: username.toLowerCase().trim(),
    phone: phone.trim(),
    password: bcrypt.hashSync(password, 10),
    otp,
    otpExpiry: otpExpiry.toISOString()
  };

  res.render('verify-otp', { title: 'Verify Mobile', phone: phone.trim(), otp, error: null });
});

router.get('/verify-otp', (req, res) => {
  if (!req.session.pendingSignup || req.session.pendingSignup.type !== 'mobile') {
    return res.redirect('/signup/mobile');
  }
  const ps = req.session.pendingSignup;
  res.render('verify-otp', { title: 'Verify Mobile', phone: ps.phone, otp: ps.otp, error: null });
});

router.post('/verify-otp', (req, res) => {
  if (!req.session.pendingSignup || req.session.pendingSignup.type !== 'mobile') {
    return res.redirect('/signup/mobile');
  }
  const { otp } = req.body;
  const ps = req.session.pendingSignup;

  if (new Date(ps.otpExpiry) < new Date()) {
    delete req.session.pendingSignup;
    return res.render('signup-mobile', { title: 'Sign Up with Mobile', error: 'OTP expired. Please sign up again.', name: ps.name, username: ps.username, phone: ps.phone });
  }
  if (otp !== ps.otp) {
    return res.render('verify-otp', { title: 'Verify Mobile', phone: ps.phone, otp: ps.otp, error: 'Invalid OTP code' });
  }

  const customer = insertOne('customers', {
    name: ps.name,
    username: ps.username,
    email: '',
    phone: ps.phone,
    password: ps.password,
    email_verified: false,
    phone_verified: true,
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  delete req.session.pendingSignup;
  req.session.customer = { id: customer.id, name: customer.name, email: customer.email || '' };
  const returnTo = req.session.returnTo || '/';
  delete req.session.returnTo;
  res.redirect(returnTo);
});

// ==================== LOGIN ====================
router.get('/login', (req, res) => {
  if (req.session.customer) return res.redirect('/account');
  const lockedUntil = req.query.locked;
  let lockMsg = null;
  if (lockedUntil) {
    const secs = Math.max(0, Math.ceil((new Date(lockedUntil) - new Date()) / 1000));
    if (secs > 0) lockMsg = `Account locked. Try again in ${secs} seconds.`;
  }
  res.render('login', { title: 'Login', error: lockMsg || req.query.error || null, login: null });
});

router.post('/login', (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.render('login', { title: 'Login', error: 'Please fill in all fields', login });
  }

  const customer = findCustomerByLogin(login);
  if (!customer) {
    return res.render('login', { title: 'Login', error: 'No account found with that email, phone, or username', login });
  }

  if (isLockedOut(customer)) {
    const secs = getLockoutSeconds(customer);
    return res.render('login', { title: 'Login', error: `Account locked due to too many failed attempts. Try again in ${secs} seconds.`, login });
  }

  if (!bcrypt.compareSync(password, customer.password)) {
    const updates = recordFailedAttempt(customer);
    const remaining = LOCKOUT_ATTEMPTS - (updates.failed_attempts || 0);
    if (remaining <= 0) {
      const secs = getLockoutSeconds({ locked_until: updates.locked_until });
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
