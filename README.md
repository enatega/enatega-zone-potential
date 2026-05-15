<div align="center">

# Enatega Zone Potential AI

**AI-powered delivery market zone analyzer — React Edition**

Instantly score any city's zones for food delivery, grocery delivery, ride booking/sharing, and courier delivery launch potential.

[![MIT License](https://img.shields.io/badge/license-MIT-5b5bd6?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite)](https://vitejs.dev)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=flat-square&logo=openai)](https://openai.com)
[![Geoapify](https://img.shields.io/badge/Geoapify-Places-FF6B6B?style=flat-square)](https://geoapify.com)

---

```
 Enter City & Zones  →  Collect Market Signals  →  AI Scores Zones  →  Launch Recommendations
```

</div>

---

## ✨ What It Does

Enter a country, city, and list of zones/areas — the tool returns a **zone-by-zone market score** (35–96) for four delivery verticals, a recommended launch sequence, risk levels, and vendor/rider targets.

> **Works without any API keys.** Signal-estimation mode uses geographic math to estimate scores. Add OpenAI and Geoapify keys in Settings for AI-powered analysis with real local market data.

---

## 🗺️ How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    Enatega Zone AI — Flow                       │
├──────────────┬──────────────────┬───────────────┬──────────────┤
│  1. INPUT    │   2. SIGNALS     │   3. ANALYSIS  │  4. OUTPUT   │
│              │                  │                │              │
│  Country     │  Geoapify Places │  OpenAI GPT    │  Score/100   │
│  City        │  ─ Restaurants   │  ─ Scoring     │  Potential   │
│  Zones[]     │  ─ Grocery       │  ─ Verticals   │  Best Fit    │
│              │  ─ Transport     │  ─ Risk Level  │  Sequence    │
│              │  ─ Commercial    │                │  Targets     │
│              │                  │  ── OR ──      │              │
│              │  (optional)      │  Signal Math   │  Recs        │
└──────────────┴──────────────────┴───────────────┴──────────────┘
```

### Analysis Modes

| Mode | Keys Required | Data Source | Best For |
|------|--------------|-------------|----------|
| **AI + Signals** | OpenAI + Geoapify | Real places data + GPT | Production use |
| **AI only** | OpenAI | AI market estimation | Quick AI insights |
| **Signal only** | Geoapify | Real places, formula scoring | No AI cost |
| **Estimation** | None | Formula-based | Demo / testing |

---

## 🚀 Quick Start (Local)

### Prerequisites

- **Node.js** ≥ 18.x ([download](https://nodejs.org))
- **npm** ≥ 9.x (comes with Node)
- Git

### 1 — Clone the repo

```bash
git clone https://github.com/your-org/enatega-zone-potential-ai.git
cd enatega-zone-potential-ai
```

### 2 — Install dependencies

```bash
npm install
```

### 3 — Run the development server

```bash
npm run dev
```

The app opens at **http://localhost:5173** automatically.

### 4 — Add API keys (optional)

Click the ⚙ **Settings** button in the top-right corner of the app.

```
┌────────────────────────────────────────────┐
│  Settings Panel                            │
│  ──────────────────────────────────────── │
│  Analysis Mode:  [AI (OpenAI)       ▼]    │
│  OpenAI Key:     [sk-...              ]    │
│  OpenAI Model:   [gpt-4o-mini         ]    │
│  Geoapify Key:   [optional            ]    │
│  CTA URL:        [https://...         ]    │
│  CTA Label:      [Book a Call         ]    │
│                           [ Save ]         │
└────────────────────────────────────────────┘
```

> ⚠️ **Security:** Keys are stored only in your **browser's localStorage**. They are sent directly to OpenAI / Geoapify — never to any third-party server. Do not commit `.env` files with keys.

---

## 🌐 Deploying to a Live Server

### Option A — Vercel (recommended, free)

```bash
# Install Vercel CLI
npm install -g vercel

# Build and deploy
npm run build
vercel --prod
```

Or connect your GitHub repo directly at [vercel.com/new](https://vercel.com/new) — Vercel auto-detects Vite.

### Option B — Netlify

```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

Or drag-and-drop the `dist/` folder at [app.netlify.com](https://app.netlify.com).

### Option C — GitHub Pages

```bash
# Install gh-pages helper
npm install --save-dev gh-pages

# Add to package.json scripts:
# "deploy": "vite build && gh-pages -d dist"

npm run deploy
```

> Set `base: '/your-repo-name/'` in `vite.config.js` if deploying to a subpath.

### Option D — Self-hosted (nginx / Apache)

```bash
# Build the static files
npm run build

# Copy dist/ to your server
scp -r dist/ user@yourserver.com:/var/www/enatega-zone-ai/
```

**nginx config snippet:**

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/enatega-zone-ai;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 📊 Scoring System

Each zone is scored 35–96 based on five weighted components:

```
Zone Score = Supply Score (max 35)
           + Mobility Score (max 16)
           + Demand Score (max 24)
           + Feasibility (16)
           + Vertical Fit (max 14)
           − Competition Penalty (max 8)
```

| Score Range | Label | Meaning |
|-------------|-------|---------|
| 80 – 96 | 🟢 High Potential | Launch immediately, prioritize |
| 60 – 79 | 🟡 Good Test Market | Controlled pilot recommended |
| 40 – 59 | 🟠 Needs Validation | Survey first, smaller radius |
| 35 – 39 | 🔴 Not Recommended | Revisit in next phase |

---

## 🏗️ Project Structure

```
enatega-zone-potential-ai/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx          # Main app component + all logic
│   ├── App.css          # Styles (matching original plugin)
│   └── main.jsx         # React entry point
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

### Key functions in `App.jsx`

| Function | Purpose |
|----------|---------|
| `collectMarketSignals()` | Fetches Geoapify Places data per zone |
| `generateAIAnalysis()` | Calls OpenAI with signals + schema |
| `signalBasedAnalysis()` | Formula-based fallback (no AI) |
| `normalizeAIResponse()` | Sanitizes & clamps AI output |
| `validateText()` | Rejects junk/test/URL inputs |
| `haversineKm()` | Distance check for zone validity |

---

## 🔑 API Keys

### OpenAI (for AI analysis)

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a new secret key
3. Paste it in the app's Settings panel

**Default model:** `gpt-4o-mini` (fast, cheap, accurate enough for this task)

### Geoapify (for real market signals)

1. Register at [myprojects.geoapify.com](https://myprojects.geoapify.com)
2. Create a project → copy the API key
3. Paste it in the app's Settings panel

**Free tier:** 3,000 requests/day — sufficient for most demo usage.

> 🔐 Both keys are stored **only in your browser's localStorage**. Nothing is stored server-side. The app is fully static.

---

## 🔧 Configuration Reference

All settings are managed through the in-app Settings panel and persisted to `localStorage` under the key `ezpai_config`.

| Setting | Default | Description |
|---------|---------|-------------|
| `mode` | `signal` | `ai` or `signal` |
| `openai_api_key` | `""` | Your OpenAI secret key |
| `openai_model` | `gpt-4o-mini` | Any chat completion model |
| `geoapify_api_key` | `""` | Your Geoapify API key |
| `cta_url` | `/contact/` | CTA button destination |
| `cta_label` | `Book a Free Launch Strategy Call` | CTA button text |

---

## 🛡️ Security Notes

- **No backend required** — the app is 100% static HTML/JS
- **No keys are ever logged or transmitted** to any server except the API providers directly
- **No cookies** — localStorage only, cleared when the user clears browser data
- **Input validation** — all location inputs are validated client-side before any API call
- **Rate limiting** — handled upstream by OpenAI and Geoapify

For production deployments where you want to hide API keys from end users, consider building a **thin proxy server** (Node/Express or a serverless function) that holds the keys server-side and forwards requests.

---

## 🌍 Example Usage

**Input:**
```
Country: Pakistan
City: Lahore
Zones: DHA Phase 5, Gulberg, Johar Town, Model Town
```

**Output:**
```
Average Score: 74/100 — Good Test Market
Best First Zone: DHA Phase 5 (Score: 84)
Launch Model: Food, Grocery, Ride & Courier delivery
Suggested Approach: AI-assisted phased launch

Zone breakdown:
─ DHA Phase 5   84  High Potential   Food, Grocery    Risk: Medium
─ Gulberg       78  Good Test Market Food, Courier     Risk: Medium-High
─ Johar Town    71  Good Test Market Grocery, Courier  Risk: Medium-High
─ Model Town    65  Good Test Market Ride, Food        Risk: High
```

---

## 🤝 Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

[MIT](LICENSE) © [Enatega](https://enatega.com)

---

<div align="center">

Built with ❤️ by the [Enatega](https://enatega.com) team · [Website](https://enatega.com) 

</div>
