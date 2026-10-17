# ⚡ Movies.snishad — Backend REST API & Admin Console

The official backend server for **Movies.snishad** — high-performance REST APIs, automated hourly TMDB sync engine, multi-server stream resolver, direct cloud download proxy, and Apple HIG-inspired administration console built with **Next.js 14**, **Prisma ORM**, and **MySQL**.

Engineered by **SNishad** ([@snishad.me_](https://instagram.com/snishad.me_)).

---

## 🔗 Related Repositories

* 🍿 **Frontend Cinema Web Client:** [https://github.com/snishad0198/movies-frontend](https://github.com/snishad0198/movies-frontend)
* 📖 **Full Platform Documentation & Deployment Guide:** [https://github.com/snishad0198/movies-docs](https://github.com/snishad0198/movies-docs)
* 📦 **All-in-One Full-Stack Monorepo:** [https://github.com/snishad0198/movies-web](https://github.com/snishad0198/movies-web)

---

## 🌟 Highlights & Features

- **🔄 Automated Hourly TMDB Box Office Sync:** Continuously imports latest trending movies & series from TMDB with sub-5ms in-memory caching.
- **🛡️ Database TMDB Storage:** Securely stores your private TMDB API key in the database with instant live test validation from `/admin/settings` (Zero GitHub exposure).
- **🎛️ Apple HIG-Inspired Admin Console:** Complete management suite for movies, web series, genres, media uploads, streaming servers, and analytics at `/admin`.
- **📥 High-Speed Cloud Downloader:** Direct multi-resolution download link resolution and download tracking.
- **⚡ Sub-Millisecond Database Operations:** Optimized Prisma connection pooling with clean relational schema.

---

## 🚀 Quickstart & Local Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
Create `.env` by copying `.env.example`:
```bash
cp .env.example .env
```
Key variables:
```env
# MySQL Database Connection (Local XAMPP or Cloud MySQL)
DATABASE_URL="mysql://root:@localhost:3306/movies_snishad"

# Security tokens (Minimum 32 characters)
JWT_SECRET="movies-snishad-super-secret-jwt-key-min-32-chars-2026"
INTERNAL_API_KEY="movies-snishad-secure-internal-token-2026"

# Frontend origins allowed to query API
ALLOWED_FRONTEND_ORIGINS="http://localhost:3000,http://localhost:3001,https://yourdomain.com"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"

# Initial Admin Credentials
ADMIN_EMAIL="admin@moviessnishad.com"
ADMIN_PASSWORD="Admin@123456"
```

### 3. Initialize Database Schema
```bash
npx prisma db push
npx prisma db seed
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000/admin/login](http://localhost:3000/admin/login) in your browser:
* **Email:** `admin@moviessnishad.com`
* **Password:** `Admin@123456`

---

## 🔑 How to Setup TMDB API Key

1. Register for a free account at [themoviedb.org](https://www.themoviedb.org/) and request a Developer API key.
2. Log in to the Admin Console at [http://localhost:3000/admin/settings](http://localhost:3000/admin/settings).
3. Open **"TMDB API & Sync"**, paste your key, click **"Test Connection"**, and save.
4. Your key is stored in your private database with zero risk of git leakage!

---

## 🐳 Docker & VPS Hosting

Build and run with Docker:
```bash
docker build -t movies-backend .
docker run -p 3000:3000 --env-file .env movies-backend
```

Or deploy with PM2 on Ubuntu:
```bash
npm run build
pm2 start npm --name "movies-backend" -- run start -p 3000
pm2 save
pm2 startup
```

---

## ⚖️ License & Usage Policy

* 🟢 **Personal & Educational Use:** **100% Free** for personal entertainment, learning, and non-commercial development.
* 🔴 **Commercial & Business Use:** Commercial usage, monetization, SaaS deployment, resale, or paid service distribution is **strictly prohibited without prior permission**. For a commercial license, please contact **SNishad**:
  * **Instagram:** [@snishad.me_](https://instagram.com/snishad.me_)
  * **Email:** `snishad01985@gmail.com`

---

## 💬 Creator & Support

* **Created By:** **SNishad**
* **Instagram:** [@snishad.me_](https://instagram.com/snishad.me_)
* **Email:** `snishad01985@gmail.com`
