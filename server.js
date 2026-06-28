require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

initDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'trinity-woodenworks-fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000,
    secure: false,
    httpOnly: true
  }
}));

app.use((req, res, next) => {
  res.locals.cartCount = req.session.cart ? req.session.cart.reduce((sum, item) => sum + item.quantity, 0) : 0;
  res.locals.isAdmin = req.session.admin ? true : false;
  res.locals.currentPath = req.path;
  res.locals.customer = req.session.customer || null;
  next();
});

app.use('/', require('./routes/pages'));
app.use('/', require('./routes/customers'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/admin', require('./routes/admin'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(500).render('error', { title: 'Error', error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Trinity Woodenworks running at http://localhost:${PORT}`);
});
