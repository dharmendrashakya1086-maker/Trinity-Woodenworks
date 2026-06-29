const express = require('express');
const router = express.Router();
const { getDB, generateId } = require('../database');

function generateOrderNumber() {
  const date = new Date();
  const prefix = 'TW';
  const datePart = date.getFullYear().toString().slice(-2) + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${datePart}${random}`;
}

router.post('/place', (req, res) => {
  const db = getDB();
  const { name, email, phone, address, city, state, pincode, payment_method, notes } = req.body;
  const cart = req.session.cart;

  if (!cart || cart.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const settings = {};
  db.get('site_settings').value().forEach(s => settings[s.key] = s.value);
  const freeShippingAbove = parseFloat(settings.free_shipping_above) || 1000;
  const shippingCost = subtotal >= freeShippingAbove ? 0 : parseFloat(settings.shipping_cost) || 0;
  const total = subtotal + shippingCost;
  const orderNumber = generateOrderNumber();

  try {
    // Create order
    const maxOrderId = db.get('orders').map('id').max().value() || 0;
    const order = {
      id: maxOrderId + 1,
      order_number: orderNumber,
      customer_id: req.session.customer ? req.session.customer.id : null,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      customer_address: address,
      customer_city: city,
      customer_state: state,
      customer_pincode: pincode,
      subtotal,
      shipping_cost: shippingCost,
      total,
      payment_method: payment_method || 'cod',
      payment_status: 'pending',
      order_status: 'pending',
      notes: notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.get('orders').push(order).write();

    // Create order items and update stock
    cart.forEach(item => {
      const maxItemId = db.get('order_items').map('id').max().value() || 0;
      db.get('order_items').push({
        id: maxItemId + 1,
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.name,
        product_price: item.price,
        quantity: item.quantity
      }).write();

      // Update stock
      const product = db.get('products').find({ id: item.product_id }).value();
      if (product) {
        db.get('products').find({ id: item.product_id }).assign({ stock: product.stock - item.quantity }).write();
      }
    });

    req.session.cart = [];
    res.json({ success: true, order_number: orderNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

router.get('/track/:orderNumber', (req, res) => {
  const db = getDB();
  const order = db.get('orders').find({ order_number: req.params.orderNumber }).value();
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const items = db.get('order_items').filter({ order_id: order.id }).value();
  res.json({ order, items });
});

module.exports = router;
