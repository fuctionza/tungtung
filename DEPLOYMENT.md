# 🚀 TungTung restaurant - Deployment & Configuration Guide

**Project Name**: `TungTung restaurant`  
**Owner / Deployment Account**: `nananashop19911@gmail.com`  
**Application Type**: Full-Stack Real-Time Multiplayer Educational Cooking & English Grammar Web Application  

---

## 📖 Overview
**TungTung restaurant** is a real-time multiplayer educational cooking and English grammar web application inspired by Kahoot and Blooket. It provides classroom synchronization between a Host/Teacher Projector Dashboard and Student Player clients.

### 🌟 Key Features
1. **100% English Language System**: All user interfaces, instructions, workstation headings, item names, and grammar quizzes are 100% strictly in English.
2. **Automatic Random Team Assignment**: Players joining via 4-digit PIN or QR code are automatically load-balanced into **Team Alpha** (🔥), **Team Bravo** (⚡), **Team Charlie** (🌿), or **Team Delta** (👑) with zero multi-step friction.
3. **Decoupled URL Architecture**:
   - **Player Screen**: `/` (`public/index.html`) — Student-only UI without any host controls.
   - **Host Dashboard**: `/host.html` (`public/host.html`) — Single-view real-time teacher dashboard with PIN display, dynamic QR code, and stage controllers.
4. **Refined Grammar UI & Text Sizing**: Clean typography across "There is" vs "There are" cashier quizzes and live plating grammar assistants.
5. **Interactive Kitchen Workstations**:
   - **Cutting Board**: Slice and chop any pantry ingredient with knife animations.
   - **Sizzling Wok Pan**: Sauté and stir-fry with progressive sizzle bars.
   - **Simmering Pot**: Bubble broths and multi-ingredient soups.
   - **Bamboo Steamer**: Gently steam delicate vegetables and dumplings.
   - **Baking Oven**: Roast and bake ingredients at 200°C.
   - **Mortar & Pestle**: Crush pastes, spices, and green papaya salads.
   - **BBQ Charcoal Grill**: Flip skewers and fillets over hot coals.
6. **Creative Plating & Real-Time Grammar NLP**:
   - Customizable plates (Classic Porcelain, Modern Dark Slate, Rustic Wood, Royal Gold).
   - Draggable, rotatable, scalable cooked items and garnishes.
   - Live grammar feedback analyzing "There is" and "There are" syntax.
7. **Automated 4-Metric Evaluation Engine**:
   - Budget Management (25 pts)
   - Time Efficiency (25 pts)
   - Grammar Mastery (30 pts)
   - Plating Presentation (20 pts)
8. **Web Audio API Sound Synthesizer**: Fully procedural sound effects (chops, sizzles, cash register, victory fanfares).

---

## 🛠️ Local Development & Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Application
```bash
node server.js
```

### 3. Open in Browser
- **Player Screen**: `http://localhost:3000/`
- **Host Dashboard**: `http://localhost:3000/host.html`
- **Health Check**: `http://localhost:3000/api/health`
- **Server Info**: `http://localhost:3000/api/server-info`

---

## ☁️ Production Deployment Pipelines

### Option A: Render.com (Recommended for WebSockets)
1. Push this repository to GitHub.
2. Log in to [Render](https://render.com).
3. Click **New +** -> **Web Service** (or **Blueprint**).
4. Connect the repository. Render will automatically detect `render.yaml`.
5. Set environment variable:
   - `PUBLIC_URL` = `https://<your-render-subdomain>.onrender.com`
6. Deploy! The Host QR code will automatically bind to your public URL for external mobile players.

### Option B: Quick Public Access via ngrok Tunnel
To instantly allow remote players on mobile data/external networks to join:
```bash
# Start your local server
node server.js

# In another terminal, start ngrok tunnel on port 3000
ngrok http 3000
```
- Set `PUBLIC_URL=https://<your-ngrok-id>.ngrok-free.app` in your `.env` or run with:
  `$env:PUBLIC_URL="https://<your-ngrok-id>.ngrok-free.app"; node server.js`

### Option C: Docker Container
```bash
# Build Docker image
docker build -t tungtung-restaurant:latest .

# Run container
docker run -d -p 3000:3000 -e PUBLIC_URL="https://yourdomain.com" --name tungtung-app tungtung-restaurant:latest
```

---

## 🔒 Configuration & Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server listening port | `3000` |
| `HOST` | Server bind address | `0.0.0.0` |
| `PUBLIC_URL` | Public domain for QR Code generation (Render, Railway, ngrok) | `http://<LAN-IP>:3000` |
| `NODE_ENV` | Runtime environment | `production` |
| `PROJECT_NAME` | Name of the project | `TungTung restaurant` |
| `OWNER_EMAIL` | Account owner email | `nananashop19911@gmail.com` |
