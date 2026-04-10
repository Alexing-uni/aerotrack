# ✈ AeroTrack

**Real-time flight tracker web app** built for mobile, powered by [OpenSky Network](https://opensky-network.org/) radar data.

> Track live flights, departures and arrivals at any airport — completely free.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![OpenSky](https://img.shields.io/badge/data-OpenSky%20Network-00d4ff)

---

## 📱 Features

- 🔍 **Search any flight** by callsign in real time
- ✈ **Live departures & arrivals** for any airport
- 🌍 **All airborne flights** worldwide
- 📍 Speed, altitude, heading, position for every flight
- 🔐 Works **anonymous** (free, no sign-up) or **authenticated** (10× more requests)
- 📱 Designed for **mobile** — installable as PWA
- ⚡ Server-side caching — fast and API-friendly
- 🛡 Helmet, rate-limiting, CORS protection built in

---

## 🚀 Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/aerotrack.git
cd aerotrack
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in your settings. Minimum required: none (anonymous mode works out of the box).

### 4. Run

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Open **http://localhost:3000** on your phone or browser.

---

## ⚙️ Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `OPENSKY_CLIENT_ID` | _(empty)_ | Your OpenSky client ID (optional) |
| `OPENSKY_CLIENT_SECRET` | _(empty)_ | Your OpenSky client secret (optional) |
| `CACHE_TTL` | `30` | Cache duration in seconds |
| `RATE_LIMIT_MAX` | `100` | Max requests per IP per 15 min |
| `ALLOWED_ORIGINS` | `*` | Allowed CORS origins |

### 🔑 Getting OpenSky credentials (optional but recommended)

Without credentials: **400 req/day** (anonymous)  
With credentials: **4,000 req/day**

1. Register at [opensky-network.org](https://opensky-network.org/index.php?option=com_users&view=registration)
2. Go to [My OpenSky → Account](https://opensky-network.org/my-opensky/account)
3. Copy your **Client ID** and **Client Secret**
4. Paste them into your `.env` file

> ⚠️ **Never commit your `.env` file to GitHub.** It's already in `.gitignore`.

---

## 📡 API Reference

All endpoints are under `/api/flights/`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server status & mode |
| GET | `/api/flights/airports` | List of common airports |
| GET | `/api/flights/search?q=IBE6250` | Search flight by callsign |
| GET | `/api/flights/live` | All airborne flights |
| GET | `/api/flights/live?lamin=35&lomin=-10&lamax=44&lomax=5` | Flights in bounding box |
| GET | `/api/flights/departures/LEMD` | Departures from airport (ICAO) |
| GET | `/api/flights/arrivals/LEMD` | Arrivals at airport (ICAO) |
| GET | `/api/flights/track/:icao24` | Flight path for aircraft |

### IATA → ICAO callsign prefixes

| IATA | ICAO | Airline |
|---|---|---|
| IB | IBE | Iberia |
| VY | VLG | Vueling |
| FR | RYR | Ryanair |
| U2 | EZY | easyJet |
| LH | DLH | Lufthansa |
| AA | AAL | American Airlines |
| BA | BAW | British Airways |
| AF | AFR | Air France |
| KL | KLM | KLM |
| UX | AEA | Air Europa |

---

## 🧪 Test the API

Make sure the server is running, then:

```bash
npm test
```

---

## 📦 Deploy

### Railway / Render / Fly.io

1. Push to GitHub
2. Connect your repo to Railway/Render
3. Add your environment variables in the dashboard
4. Deploy — done!

### VPS / Docker

```bash
# Build and run manually
npm install --production
NODE_ENV=production npm start
```

For Docker, a `Dockerfile` can be added easily — open an issue if you need one.

---

## 🗂 Project Structure

```
aerotrack/
├── server/
│   ├── index.js          # Express app entry point
│   ├── opensky.js        # OpenSky API service layer
│   ├── test-api.js       # API test script
│   ├── routes/
│   │   └── flights.js    # Flight route handlers
│   └── middleware/
│       └── logger.js     # Request logger
├── public/
│   ├── index.html        # Mobile web app
│   ├── manifest.json     # PWA manifest
│   ├── css/
│   │   └── app.css       # Styles
│   └── js/
│       └── app.js        # Frontend logic
├── .env.example          # ← copy to .env and fill in
├── .gitignore
├── package.json
└── README.md
```

---

## 📄 License

MIT — free to use, fork and deploy.

---

## 🙏 Credits

- Flight data: [OpenSky Network](https://opensky-network.org/)
- Built with Node.js + Express
- UI inspired by [Flighty](https://www.flightyapp.com/)
