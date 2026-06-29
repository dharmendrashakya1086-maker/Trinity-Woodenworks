const express = require('express');
const router = express.Router();
const { getDB } = require('../database');

function requireCustomer(req, res, next) {
  if (req.session.customer) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

router.get('/', (req, res) => {
  const db = getDB();
  const featuredCategories = db.get('categories').filter({ featured: 1 }).value().map(c => ({
    ...c,
    product_count: db.get('products').filter({ category_id: c.id, status: 'active' }).size().value()
  }));
  const latest = db.get('products').filter({ status: 'active' }).sortBy('created_at').reverse().take(4).value().map(p => ({
    ...p,
    category_name: p.category_id ? (db.get('categories').find({ id: p.category_id }).value() || {}).name : null
  }));
  const categories = db.get('categories').value();
  const stats = {
    products: db.get('products').filter({ status: 'active' }).size().value(),
    orders: db.get('orders').size().value()
  };
  res.render('home', { featuredCategories, latest, categories, stats });
});

router.get('/categories', (req, res) => {
  const db = getDB();
  const categories = db.get('categories').value().map(c => ({
    ...c,
    product_count: db.get('products').filter({ category_id: c.id, status: 'active' }).size().value()
  }));
  res.render('categories', { categories });
});

router.get('/shop', (req, res) => {
  const db = getDB();
  const category = req.query.category || '';
  const search = req.query.search || '';
  const sort = req.query.sort || 'newest';
  const page = parseInt(req.query.page) || 1;
  const limit = 12;
  const offset = (page - 1) * limit;

  let products = db.get('products').filter({ status: 'active' });

  if (category) {
    products = products.filter({ category_id: parseInt(category) });
  }
  if (search) {
    const s = search.toLowerCase();
    products = products.filter(p => p.name.toLowerCase().includes(s) || (p.description && p.description.toLowerCase().includes(s)));
  }

  let arr = products.value();
  switch(sort) {
    case 'price_low': arr.sort((a,b) => (a.sale_price || a.price) - (b.sale_price || b.price)); break;
    case 'price_high': arr.sort((a,b) => (b.sale_price || b.price) - (a.sale_price || a.price)); break;
    case 'name': arr.sort((a,b) => a.name.localeCompare(b.name)); break;
    default: arr.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  }

  const total = arr.length;
  const totalPages = Math.ceil(total / limit);
  const paged = arr.slice(offset, offset + limit).map(p => ({
    ...p,
    category_name: p.category_id ? (db.get('categories').find({ id: p.category_id }).value() || {}).name : null
  }));
  const categories = db.get('categories').value();
  const currentCategory = category ? db.get('categories').find({ id: parseInt(category) }).value() : null;

  res.render('shop', { products: paged, categories, category, search, sort, page, totalPages, total, currentCategory });
});

router.get('/product/:id', (req, res) => {
  const db = getDB();
  const product = db.get('products').find({ id: parseInt(req.params.id) }).value();
  if (!product) return res.redirect('/shop');

  const cat = product.category_id ? db.get('categories').find({ id: product.category_id }).value() : null;
  product.category_name = cat ? cat.name : null;

  const images = db.get('product_images').filter({ product_id: product.id }).value();
  const related = db.get('products').filter({ category_id: product.category_id, status: 'active' }).value()
    .filter(p => p.id !== product.id).slice(0, 4).map(p => ({
      ...p,
      category_name: p.category_id ? (db.get('categories').find({ id: p.category_id }).value() || {}).name : null
    }));

  res.render('product', { product, images, related });
});

// Direct buy - add to cart and go to checkout
router.get('/buy/:id', requireCustomer, (req, res) => {
  const db = getDB();
  const product = db.get('products').find({ id: parseInt(req.params.id), status: 'active' }).value();
  if (!product) return res.redirect('/shop');
  if (product.stock < 1) return res.redirect('/product/' + product.id);

  // Clear cart and add only this item
  req.session.cart = [{
    product_id: product.id,
    name: product.name,
    price: product.sale_price || product.price,
    image: product.image,
    quantity: 1,
    stock: product.stock
  }];

  res.redirect('/checkout');
});

router.get('/checkout', requireCustomer, (req, res) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.redirect('/cart');

  const db = getDB();
  const settings = {};
  db.get('site_settings').value().forEach(s => settings[s.key] = s.value);

  let customer = null;
  if (req.session.customer) {
    customer = db.get('customers').find({ id: req.session.customer.id }).value() || null;
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const freeShippingAbove = parseFloat(settings.free_shipping_above) || 1000;
  const shippingCost = subtotal >= freeShippingAbove ? 0 : parseFloat(settings.shipping_cost) || 0;
  const total = subtotal + shippingCost;

  res.render('checkout', { cart, subtotal, shippingCost, total, settings, customer });
});

router.get('/cart', (req, res) => {
  const cart = req.session.cart || [];
  const db = getDB();
  const settings = {};
  db.get('site_settings').value().forEach(s => settings[s.key] = s.value);

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const freeShippingAbove = parseFloat(settings.free_shipping_above) || 1000;
  const shippingCost = subtotal >= freeShippingAbove ? 0 : parseFloat(settings.shipping_cost) || 0;

  res.render('cart', { cart, subtotal, shippingCost });
});

router.get('/order-confirmation/:orderNumber', (req, res) => {
  const db = getDB();
  const order = db.get('orders').find({ order_number: req.params.orderNumber }).value();
  if (!order) return res.redirect('/');
  res.render('order-confirmation', { order });
});

router.get('/about', (req, res) => {
  res.render('about');
});

router.get('/contact', (req, res) => {
  res.render('contact');
});

router.get('/track-order', (req, res) => {
  const db = getDB();
  let myOrders = [];
  if (req.session.customer) {
    myOrders = db.get('orders')
      .filter(o => o.customer_id === req.session.customer.id || o.customer_email === req.session.customer.email)
      .sortBy('created_at')
      .reverse()
      .take(10)
      .value();
  }
  res.render('track-order', { order: null, myOrders, searched: false });
});

router.post('/track-order', (req, res) => {
  const db = getDB();
  const order = db.get('orders').find({ order_number: req.body.order_number }).value();
  let myOrders = [];
  if (req.session.customer) {
    myOrders = db.get('orders')
      .filter(o => o.customer_id === req.session.customer.id || o.customer_email === req.session.customer.email)
      .sortBy('created_at')
      .reverse()
      .take(10)
      .value();
  }
  res.render('track-order', { order, myOrders, searched: true });
});

module.exports = router;
