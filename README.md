# ✦ JJK License API & Admin Panel Backend ✦

Yeh project aapke **QShim 2.0 APK** aur **JJK License Admin Panel** ka complete backend hai.

---

## 📁 Project Structure
```
jjk-license-backend/
├── public/
│   └── index.html         # Aapka recovered Neon Admin Panel UI
├── api/
│   ├── license-status.js  # App ke liye status endpoint (GET /api/license-status?deviceId=...)
│   ├── request-license.js # Device request endpoint (POST /api/request-license)
│   └── admin/
│       ├── get-licenses.js# Keys list load karna
│       ├── create-key.js  # Nayi key forge karna
│       ├── block-key.js   # Key block/unblock karna
│       ├── reset-device.js# Device unbind/reset karna
│       └── extend-key.js  # Key validity extend karna
├── lib/
│   ├── db.js              # Database adapter (MongoDB + Local Fallback)
│   └── auth.js            # Admin security validator
├── server.js              # Local test karne ke liye Express server
├── vercel.json            # Vercel deployment configuration
└── package.json           # Dependencies
```

---

## 🚀 Vercel Par Deploy Kaise Karein (Step-by-Step)

### Option 1: Vercel CLI (Sabse Aasan & Fast)
1. Terminal / PowerShell open karein aur is folder me jayein:
   ```bash
   cd "C:\Users\pintu\Downloads\jjk-license-backend"
   ```
2. Vercel CLI se login karke deploy karein:
   ```bash
   npm install -g vercel
   vercel
   ```
3. Prompt follow karein (nayi email se login karein). 1 minute me aapko naya live URL mil jayega (e.g. `https://my-jjk-license.vercel.app`).

### Option 2: GitHub + Vercel Dashboard
1. Is folder ko apne **GitHub** par nayi repository me upload karein.
2. Naye Vercel account ([vercel.com](https://vercel.com)) me login karke **"Add New Project"** select karein.
3. Apni GitHub repo choose karein aur **Deploy** click kar dein!

---

## ⚙️ Environment Variables (Vercel Project Settings)
Vercel Settings -> Environment Variables me ye add karein:
* `ADMIN_TOKEN`: Aapka secret password (Admin panel me login karne ke liye, default: `admin123`).
* `MONGODB_URI`: (Recommended for permanent cloud storage) MongoDB Atlas ka free URI (e.g. `mongodb+srv://user:pass@cluster.mongodb.net/jjk?retryWrites=true&w=majority`).

---

## 💻 Local PC Par Test Kaise Karein
Agar aap Vercel par daalne se pehle apne PC par check karna chahte hain:
```bash
cd "C:\Users\pintu\Downloads\jjk-license-backend"
npm install
npm start
```
Browser me open karein: `http://localhost:3000` (Admin Token: `admin123`).
