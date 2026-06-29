const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const adapter = new FileSync(path.join(dataDir, 'db.json'));
let database;

function getDB() {
  if (!database) {
    database = low(adapter);
    database.defaults({
      admin: [],
      customers: [],
      categories: [],
      products: [],
      product_images: [],
      orders: [],
      order_items: [],
      site_settings: [],
      messages: []
    }).write();
  }
  return database;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function initDB() {
  getDB();

  // Create default admin
  const adminExists = database.get('admin').size().value();
  if (adminExists === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    database.get('admin').push({ id: 1, username: 'admin', password: hash, name: 'Trinity Admin', created_at: new Date().toISOString() }).write();
  }

  // Create default categories
  const catCount = database.get('categories').size().value();
  if (catCount === 0) {
    const cats = [
      { id: 1, name: 'Wooden Decor', description: 'Beautiful handcrafted wooden decorative items for your home', image: null, icon: 'fa-snowflake', featured: 1, created_at: new Date().toISOString() },
      { id: 2, name: 'Furniture', description: 'Premium handcrafted wooden furniture pieces', image: null, icon: 'fa-couch', featured: 1, created_at: new Date().toISOString() },
      { id: 3, name: 'Kitchen & Dining', description: 'Wooden kitchen accessories and dining items', image: null, icon: 'fa-utensils', featured: 0, created_at: new Date().toISOString() },
      { id: 4, name: 'Gifting', description: 'Perfect wooden gift items for your loved ones', image: null, icon: 'fa-gift', featured: 1, created_at: new Date().toISOString() },
      { id: 5, name: 'Custom Orders', description: 'Customized wooden items made to your specifications', image: null, icon: 'fa-pencil-ruler', featured: 0, created_at: new Date().toISOString() }
    ];
    database.get('categories').push(...cats).write();
  } else {
    // Ensure existing categories have featured, image, icon fields
    database.get('categories').each(cat => {
      const updates = {};
      if (cat.featured === undefined) updates.featured = 0;
      if (cat.image === undefined) updates.image = null;
      if (cat.icon === undefined) {
        const iconMap = { 'Wooden Decor': 'fa-snowflake', 'Furniture': 'fa-couch', 'Kitchen & Dining': 'fa-utensils', 'Gifting': 'fa-gift', 'Custom Orders': 'fa-pencil-ruler' };
        updates.icon = iconMap[cat.name] || 'fa-layer-group';
      }
      if (Object.keys(updates).length > 0) {
        database.get('categories').find({ id: cat.id }).assign(updates).write();
      }
    }).value();
  }

  // Create default settings
  const settingsCount = database.get('site_settings').size().value();
  if (settingsCount === 0) {
    const settings = [
      { key: 'site_name', value: 'Trinity Woodenworks' },
      { key: 'tagline', value: 'Crafted with Passion, Built to Last' },
      { key: 'phone', value: '+91 98765 43210' },
      { key: 'email', value: 'info@trinitywoodenworks.com' },
      { key: 'address', value: 'Jaipur, Rajasthan, India' },
      { key: 'shipping_cost', value: '0' },
      { key: 'free_shipping_above', value: '1000' }
    ];
    database.get('site_settings').push(...settings).write();
  }

  // Create default products if empty
  const prodCount = database.get('products').size().value();
  if (prodCount === 0) {
    const products = [
      { id: 1, name: 'Wooden Flower Vase', category_id: 1, description: 'Hand-carved wooden vase with intricate floral patterns. Perfect for home decor.', price: 1299, mrp: 1599, discount_percent: 19, sale_price: 1299, stock: 25, image: null, status: 'active', featured: 1 },
      { id: 2, name: 'Carved Wooden Wall Panel', category_id: 1, description: 'Elegant wall panel with traditional Indian motifs. Adds warmth to any room.', price: 2499, mrp: 2999, discount_percent: 17, sale_price: 2499, stock: 15, image: null, status: 'active', featured: 1 },
      { id: 3, name: 'Wooden Chess Board', category_id: 1, description: 'Premium handcrafted chess board with carved wooden pieces.', price: 1899, mrp: 2299, discount_percent: 17, sale_price: 1899, stock: 20, image: null, status: 'active', featured: 0 },
      { id: 4, name: 'Rustic Wooden Bookshelf', category_id: 2, description: '5-tier open bookshelf made from solid Sheesham wood. Rustic finish.', price: 8999, mrp: 11999, discount_percent: 25, sale_price: 8999, stock: 8, image: null, status: 'active', featured: 1 },
      { id: 5, name: 'Wooden Coffee Table', category_id: 2, description: 'Live-edge wooden coffee table with sturdy legs. Natural grain pattern.', price: 6499, mrp: 7999, discount_percent: 19, sale_price: 6499, stock: 10, image: null, status: 'active', featured: 1 },
      { id: 6, name: 'Wooden Dining Set (4 Seater)', category_id: 2, description: 'Complete dining set with table and 4 chairs. Solid wood construction.', price: 15999, mrp: 19999, discount_percent: 20, sale_price: 15999, stock: 5, image: null, status: 'active', featured: 0 },
      { id: 7, name: 'Wooden Cutting Board', category_id: 3, description: 'Thick wooden cutting board from organic teak. Food-safe finish.', price: 599, mrp: 799, discount_percent: 25, sale_price: 599, stock: 50, image: null, status: 'active', featured: 1 },
      { id: 8, name: 'Wooden Spice Box (Masala Dabba)', category_id: 3, description: 'Traditional wooden spice box with 7 compartments. Aromatic Sheesham wood.', price: 899, mrp: 1199, discount_percent: 25, sale_price: 899, stock: 30, image: null, status: 'active', featured: 0 },
      { id: 9, name: 'Personalized Wooden Nameplate', category_id: 5, description: 'Custom carved wooden nameplate for your home. Send us your name in Hindi or English.', price: 1499, mrp: 1999, discount_percent: 25, sale_price: 1499, stock: 99, image: null, status: 'active', featured: 1 },
      { id: 10, name: 'Wooden Photo Frame Set', category_id: 4, description: 'Set of 3 handcrafted wooden photo frames in different sizes. Perfect gift.', price: 999, mrp: 1299, discount_percent: 23, sale_price: 999, stock: 40, image: null, status: 'active', featured: 1 },
      { id: 11, name: 'Wooden Pen Stand', category_id: 4, description: 'Handcrafted wooden pen stand with carved design. Great desk accessory.', price: 449, mrp: 599, discount_percent: 25, sale_price: 449, stock: 60, image: null, status: 'active', featured: 0 },
      { id: 12, name: 'Carved Wooden Elephant', category_id: 1, description: 'Hand-carved wooden elephant statue. Traditional Rajasthani craftsmanship.', price: 1799, mrp: 2199, discount_percent: 18, sale_price: 1799, stock: 12, image: null, status: 'active', featured: 0 }
    ];
    database.get('products').push(...products).write();
  }
}

// Helper functions to mimic SQL-like queries
function findAll(collection, filter = {}, sort = null, limit = null, offset = 0) {
  let results = database.get(collection);
  if (filter) {
    Object.keys(filter).forEach(key => {
      if (filter[key] !== undefined && filter[key] !== '' && filter[key] !== null) {
        results = results.filter(item => {
          if (typeof filter[key] === 'object' && filter[key].$like) {
            return String(item[key]).toLowerCase().includes(filter[key].$like.toLowerCase());
          }
          if (typeof filter[key] === 'object' && filter[key].$ne) {
            return item[key] !== filter[key].$ne;
          }
          return item[key] == filter[key];
        });
      }
    });
  }
  let arr = results.value();
  if (sort) {
    const key = Object.keys(sort)[0];
    const dir = sort[key];
    arr.sort((a, b) => {
      if (a[key] < b[key]) return dir === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return dir === 1 ? 1 : -1;
      return 0;
    });
  }
  const total = arr.length;
  if (offset) arr = arr.slice(offset);
  if (limit) arr = arr.slice(0, limit);
  return { data: arr, total };
}

function findById(collection, id) {
  return database.get(collection).find({ id: parseInt(id) || id }).value();
}

function findByKey(collection, keyObj) {
  return database.get(collection).find(keyObj).value();
}

function insertOne(collection, data) {
  const maxId = database.get(collection).map('id').max().value() || 0;
  const item = { id: maxId + 1, ...data, created_at: new Date().toISOString() };
  database.get(collection).push(item).write();
  return item;
}

function updateOne(collection, keyObj, data) {
  database.get(collection).find(keyObj).assign(data, { updated_at: new Date().toISOString() }).write();
}

function removeOne(collection, keyObj) {
  database.get(collection).remove(keyObj).write();
}

function countAll(collection, filter = {}) {
  return findAll(collection, filter).total;
}

function sumField(collection, field, filter = {}) {
  return database.get(collection).filter(filter).sumBy(field).value();
}

module.exports = { getDB, initDB, findAll, findById, findByKey, insertOne, updateOne, removeOne, countAll, sumField, generateId };
