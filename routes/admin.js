const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const { getDB, insertOne, updateOne, removeOne, findAll, findById } = require('../database');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const types = /jpeg|jpg|png|gif|webp/; cb(null, types.test(path.extname(file.originalname).toLowerCase())); } });

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) {
    res.locals.adminUser = req.session.admin;
    return next();
  }
  res.redirect('/admin/login');
}

// Login
router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin/dashboard');
  res.render('admin/login', { error: null });
});

router.post('/login', (req, res) => {
  const db = getDB();
  const { username, password } = req.body;
  const admin = db.get('admin').find({ username }).value();

  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.render('admin/login', { error: 'Invalid credentials' });
  }

  req.session.admin = { id: admin.id, name: admin.name, username: admin.username };
  res.redirect('/admin/dashboard');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Dashboard
router.get('/dashboard', requireAdmin, (req, res) => {
  const db = getDB();
  const stats = {
    totalProducts: db.get('products').size().value(),
    activeProducts: db.get('products').filter({ status: 'active' }).size().value(),
    totalOrders: db.get('orders').size().value(),
    pendingOrders: db.get('orders').filter({ order_status: 'pending' }).size().value(),
    totalRevenue: db.get('orders').filter({ payment_status: 'paid' }).sumBy('total').value() || 0,
    lowStock: db.get('products').filter(p => p.stock <= 5 && p.status === 'active').size().value(),
    todayOrders: db.get('orders').filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).size().value(),
    monthlyRevenue: db.get('orders').filter(o => {
      const d = new Date(o.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && o.payment_status === 'paid';
    }).sumBy('total').value() || 0
  };
  const recentOrders = db.get('orders').sortBy('created_at').reverse().take(5).value();
  const lowStockProducts = db.get('products').filter(p => p.stock <= 5 && p.status === 'active').sortBy('stock').take(5).value().map(p => ({
    ...p,
    category_name: p.category_id ? (db.get('categories').find({ id: p.category_id }).value() || {}).name : null
  }));
  res.render('admin/dashboard', { stats, recentOrders, lowStockProducts });
});

// Products
router.get('/products', requireAdmin, (req, res) => {
  const db = getDB();
  const products = db.get('products').sortBy('created_at').reverse().value().map(p => ({
    ...p,
    category_name: p.category_id ? (db.get('categories').find({ id: p.category_id }).value() || {}).name : null
  }));
  res.render('admin/products', { products });
});

router.get('/products/add', requireAdmin, (req, res) => {
  const db = getDB();
  const categories = db.get('categories').value();
  res.render('admin/product-form', { product: null, categories });
});

router.post('/products/add', requireAdmin, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: 10 }]), (req, res) => {
  const db = getDB();
  const { name, description, mrp, discount_percent, price, category_id, stock, featured } = req.body;
  const image = req.files && req.files.image ? req.files.image[0].filename : null;

  const mrpVal = parseFloat(mrp) || 0;
  const discVal = parseFloat(discount_percent) || 0;
  const salePrice = mrpVal > 0 ? Math.round(mrpVal * (1 - discVal / 100)) : 0;

  const maxId = db.get('products').map('id').max().value() || 0;
  const product = {
    id: maxId + 1,
    name,
    description,
    mrp: mrpVal,
    discount_percent: discVal,
    price: salePrice,
    sale_price: salePrice,
    category_id: category_id ? parseInt(category_id) : null,
    stock: parseInt(stock) || 0,
    image,
    featured: featured ? 1 : 0,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  db.get('products').push(product).write();

  if (req.files && req.files.gallery) {
    const maxImgId = db.get('product_images').map('id').max().value() || 0;
    req.files.gallery.forEach((f, i) => {
      db.get('product_images').push({
        id: maxImgId + i + 1,
        product_id: product.id,
        image: f.filename,
        is_primary: i === 0 ? 1 : 0
      }).write();
    });
  }

  res.redirect('/admin/products');
});

router.get('/products/edit/:id', requireAdmin, (req, res) => {
  const db = getDB();
  const product = db.get('products').find({ id: parseInt(req.params.id) }).value();
  const categories = db.get('categories').value();
  const images = db.get('product_images').filter({ product_id: parseInt(req.params.id) }).value();
  res.render('admin/product-form', { product, categories, images });
});

router.post('/products/edit/:id', requireAdmin, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: 10 }]), (req, res) => {
  const db = getDB();
  const { name, description, mrp, discount_percent, price, category_id, stock, featured, status, remove_image } = req.body;
  let image = req.body.existing_image;

  const mrpVal = parseFloat(mrp) || 0;
  const discVal = parseFloat(discount_percent) || 0;
  const salePrice = mrpVal > 0 ? Math.round(mrpVal * (1 - discVal / 100)) : 0;

  if (remove_image === '1') {
    image = null;
  }
  if (req.files && req.files.image) {
    image = req.files.image[0].filename;
  }

  db.get('products').find({ id: parseInt(req.params.id) }).assign({
    name,
    description,
    mrp: mrpVal,
    discount_percent: discVal,
    price: salePrice,
    sale_price: salePrice,
    category_id: category_id ? parseInt(category_id) : null,
    stock: parseInt(stock) || 0,
    image,
    featured: featured ? 1 : 0,
    status: status || 'active',
    updated_at: new Date().toISOString()
  }).write();

  if (req.files && req.files.gallery) {
    const maxImgId = db.get('product_images').map('id').max().value() || 0;
    req.files.gallery.forEach((f, i) => {
      db.get('product_images').push({
        id: maxImgId + i + 1,
        product_id: parseInt(req.params.id),
        image: f.filename,
        is_primary: 0
      }).write();
    });
  }

  res.redirect('/admin/products');
});

router.post('/products/delete/:id', requireAdmin, (req, res) => {
  const db = getDB();
  db.get('product_images').remove({ product_id: parseInt(req.params.id) }).write();
  db.get('products').remove({ id: parseInt(req.params.id) }).write();
  res.redirect('/admin/products');
});

router.post('/products/delete-image/:id', requireAdmin, (req, res) => {
  const db = getDB();
  const img = db.get('product_images').find({ id: parseInt(req.params.id) }).value();
  if (img) {
    const filePath = path.join(__dirname, '..', 'uploads', img.image);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.get('product_images').remove({ id: parseInt(req.params.id) }).write();
  }
  res.redirect('back');
});

// Categories
router.get('/categories', requireAdmin, (req, res) => {
  const db = getDB();
  const categories = db.get('categories').value().map(c => ({
    ...c,
    product_count: db.get('products').filter({ category_id: c.id }).size().value()
  }));
  res.render('admin/categories', { categories });
});

router.post('/categories/add', requireAdmin, upload.single('image'), (req, res) => {
  const db = getDB();
  const { name, description, featured } = req.body;
  const image = req.file ? req.file.filename : null;
  const maxId = db.get('categories').map('id').max().value() || 0;
  db.get('categories').push({
    id: maxId + 1,
    name,
    description: description || '',
    image,
    featured: featured ? 1 : 0,
    created_at: new Date().toISOString()
  }).write();
  res.redirect('/admin/categories');
});

router.post('/categories/edit/:id', requireAdmin, upload.single('image'), (req, res) => {
  const db = getDB();
  const { name, description, existing_image, featured } = req.body;
  let image = existing_image || null;
  if (req.file) {
    image = req.file.filename;
  }
  db.get('categories').find({ id: parseInt(req.params.id) }).assign({ name, description, image, featured: featured ? 1 : 0 }).write();
  res.redirect('/admin/categories');
});

router.post('/categories/toggle-featured/:id', requireAdmin, (req, res) => {
  const db = getDB();
  const cat = db.get('categories').find({ id: parseInt(req.params.id) }).value();
  if (cat) {
    db.get('categories').find({ id: parseInt(req.params.id) }).assign({ featured: cat.featured ? 0 : 1 }).write();
  }
  res.redirect('/admin/categories');
});

router.post('/categories/delete/:id', requireAdmin, (req, res) => {
  const db = getDB();
  // Set products in this category to no category
  db.get('products').filter({ category_id: parseInt(req.params.id) }).each(p => {
    p.category_id = null;
  }).write();
  db.get('categories').remove({ id: parseInt(req.params.id) }).write();
  res.redirect('/admin/categories');
});

// Orders
router.get('/orders', requireAdmin, (req, res) => {
  const db = getDB();
  const status = req.query.status || '';
  let orders = db.get('orders').sortBy('created_at').reverse();
  if (status) {
    orders = orders.filter({ order_status: status });
  }
  res.render('admin/orders', { orders: orders.value(), status });
});

router.get('/orders/:id', requireAdmin, (req, res) => {
  const db = getDB();
  const order = db.get('orders').find({ id: parseInt(req.params.id) }).value();
  if (!order) return res.redirect('/admin/orders');
  const items = db.get('order_items').filter({ order_id: order.id }).value();
  res.render('admin/order-detail', { order, items });
});

router.post('/orders/:id/status', requireAdmin, (req, res) => {
  const db = getDB();
  const { order_status, payment_status } = req.body;
  db.get('orders').find({ id: parseInt(req.params.id) }).assign({
    order_status,
    payment_status,
    updated_at: new Date().toISOString()
  }).write();
  res.redirect('/admin/orders/' + req.params.id);
});

router.post('/orders/:id/delete', requireAdmin, (req, res) => {
  const db = getDB();
  db.get('order_items').remove({ order_id: parseInt(req.params.id) }).write();
  db.get('orders').remove({ id: parseInt(req.params.id) }).write();
  res.redirect('/admin/orders');
});

// Settings
router.get('/settings', requireAdmin, (req, res) => {
  const db = getDB();
  const settings = {};
  db.get('site_settings').value().forEach(s => settings[s.key] = s.value);
  res.render('admin/settings', { settings });
});

router.post('/settings', requireAdmin, (req, res) => {
  const db = getDB();
  Object.entries(req.body).forEach(([key, value]) => {
    const existing = db.get('site_settings').find({ key }).value();
    if (existing) {
      db.get('site_settings').find({ key }).assign({ value }).write();
    } else {
      db.get('site_settings').push({ key, value }).write();
    }
  });
  res.redirect('/admin/settings');
});

// Change password
router.post('/change-password', requireAdmin, (req, res) => {
  const db = getDB();
  const { current_password, new_password } = req.body;
  const admin = db.get('admin').find({ id: req.session.admin.id }).value();

  if (!bcrypt.compareSync(current_password, admin.password)) {
    return res.redirect('/admin/settings?error=wrong_password');
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.get('admin').find({ id: req.session.admin.id }).assign({ password: hash }).write();
  res.redirect('/admin/settings?success=password_changed');
});

module.exports = router;
