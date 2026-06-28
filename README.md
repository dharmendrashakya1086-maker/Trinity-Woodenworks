# Trinity Woodenworks

Premium handcrafted wooden items e-commerce website.

## Features
- Dark premium theme with gold accents
- Product catalog with categories
- Shopping cart & checkout
- Admin panel with product/category management
- Order tracking
- Responsive design (mobile + desktop)
- Futuristic animations & effects

## Free Deployment (Render.com)

### Step 1: Upload to GitHub
1. Create a GitHub account (free)
2. Create a new repository
3. Push all project files to GitHub

### Step 2: Deploy on Render
1. Go to [render.com](https://render.com) and sign up (free)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Settings:
   - **Name:** trinity-woodenworks
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add Environment Variable:
   - **Key:** SESSION_SECRET
   - **Value:** (any random string, e.g., `my-super-secret-key-2026`)
6. Click "Create Web Service"

### Step 3: Done!
Your website will be live at: `https://trinity-woodenworks.onrender.com`

**Note:** Free tier spins down after 15 min of inactivity. First load takes ~30 seconds.

## Local Development
```bash
npm install
npm start
```
Visit: http://localhost:3000

## Admin Panel
- URL: `/admin/dashboard`
- Username: `admin`
- Password: `admin123`

## Tech Stack
- **Backend:** Node.js + Express
- **Database:** LowDB (JSON file)
- **Frontend:** EJS templates + CSS3 + Vanilla JS
- **Hosting:** Render.com (free)
