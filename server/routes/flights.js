// ============================================================
//  AeroTrack — Flight API Routes
//  GET /api/flights/...
// ============================================================

const express = require('express');
const router  = express.Router();
const opensky = require('../opensky');

// ── Helpers ─────────────────────────────────────────────────
function ok(res, data, meta = {}) {
  res.json({ success: true, timestamp: new Date().toISOString(), ...meta, data });
}

function fail(res, err) {
  const status  = err.status || 500;
  const message = err.message || 'Internal server error';
  console.error(`[API ERROR] ${status}: ${message}`);
  res.status(status).json({ success: false, error: message });
}

// ── GET /api/flights/search?q=IB6250 ────────────────────────
// Search for a specific flight by callsign
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 3) {
    return res.status(400).json({ success: false, error: 'Query param "q" is required (min 3 chars).' });
  }

  try {
    const flight = await opensky.getFlightByCallsign(q.trim());
    if (!flight) {
      return res.status(404).json({
        success: false,
        error:   `Flight "${q.toUpperCase()}" not found. It may be on the ground or not yet departed.`,
        tip:     'Try the ICAO callsign format (e.g. IBE6250 instead of IB6250)',
      });
    }
    ok(res, flight, { query: q.toUpperCase() });
  } catch (err) {
    fail(res, err);
  }
});

// ── GET /api/flights/live ────────────────────────────────────
// All live flights (optionally filtered by bounding box)
// Query params: lamin, lomin, lamax, lomax
router.get('/live', async (req, res) => {
  const { lamin, lomin, lamax, lomax } = req.query;
  const bbox = (lamin && lomin && lamax && lomax)
    ? { lamin: parseFloat(lamin), lomin: parseFloat(lomin), lamax: parseFloat(lamax), lomax: parseFloat(lomax) }
    : null;

  try {
    const flights = await opensky.getLiveFlights(bbox);
    ok(res, flights, { count: flights.length, bbox: bbox || 'global' });
  } catch (err) {
    fail(res, err);
  }
});

// ── GET /api/flights/departures/:airport ─────────────────────
// Recent departures from an airport (ICAO code)
// Example: /api/flights/departures/LEMD
router.get('/departures/:airport', async (req, res) => {
  const airport = req.params.airport.toUpperCase();
  if (airport.length !== 4) {
    return res.status(400).json({ success: false, error: 'Airport must be a 4-letter ICAO code (e.g. LEMD, LEBL, EGLL)' });
  }

  try {
    const flights = await opensky.getDepartures(airport);
    ok(res, flights || [], { airport, count: (flights || []).length });
  } catch (err) {
    fail(res, err);
  }
});

// ── GET /api/flights/arrivals/:airport ───────────────────────
// Recent arrivals at an airport (ICAO code)
router.get('/arrivals/:airport', async (req, res) => {
  const airport = req.params.airport.toUpperCase();
  if (airport.length !== 4) {
    return res.status(400).json({ success: false, error: 'Airport must be a 4-letter ICAO code (e.g. LEMD, LEBL, EGLL)' });
  }

  try {
    const flights = await opensky.getArrivals(airport);
    ok(res, flights || [], { airport, count: (flights || []).length });
  } catch (err) {
    fail(res, err);
  }
});

// ── GET /api/flights/track/:icao24 ───────────────────────────
// Live track (path) for an aircraft by ICAO24 hex ID
router.get('/track/:icao24', async (req, res) => {
  const icao24 = req.params.icao24.toLowerCase();
  try {
    const track = await opensky.getFlightTrack(icao24);
    ok(res, track);
  } catch (err) {
    fail(res, err);
  }
});

// ── GET /api/flights/airports ─────────────────────────────────
// Common airports reference (IATA <> ICAO mapping)
router.get('/airports', (req, res) => {
  const airports = [
    { iata:'MAD', icao:'LEMD', name:'Madrid Adolfo Suárez', city:'Madrid',    country:'ES', lat:40.4936, lon:-3.5668 },
    { iata:'BCN', icao:'LEBL', name:'Barcelona El Prat',    city:'Barcelona', country:'ES', lat:41.2971, lon:2.0785  },
    { iata:'PMI', icao:'LEPA', name:'Palma de Mallorca',    city:'Palma',     country:'ES', lat:39.5517, lon:2.7388  },
    { iata:'AGP', icao:'LEMG', name:'Málaga Costa del Sol', city:'Málaga',    country:'ES', lat:36.6749, lon:-4.4991 },
    { iata:'ALC', icao:'LEAL', name:'Alicante-Elche',       city:'Alicante',  country:'ES', lat:38.2822, lon:-0.5582 },
    { iata:'SVQ', icao:'LEZL', name:'Sevilla',              city:'Sevilla',   country:'ES', lat:37.4179, lon:-5.8931 },
    { iata:'LHR', icao:'EGLL', name:'London Heathrow',      city:'London',    country:'GB', lat:51.4775, lon:-0.4614 },
    { iata:'CDG', icao:'LFPG', name:'Paris Charles de Gaulle', city:'Paris',  country:'FR', lat:49.0097, lon:2.5479  },
    { iata:'FRA', icao:'EDDF', name:'Frankfurt Main',       city:'Frankfurt', country:'DE', lat:50.0379, lon:8.5622  },
    { iata:'AMS', icao:'EHAM', name:'Amsterdam Schiphol',   city:'Amsterdam', country:'NL', lat:52.3086, lon:4.7639  },
    { iata:'FCO', icao:'LIRF', name:'Rome Fiumicino',       city:'Rome',      country:'IT', lat:41.8003, lon:12.2389 },
    { iata:'JFK', icao:'KJFK', name:'New York J.F. Kennedy',city:'New York',  country:'US', lat:40.6413, lon:-73.7781},
    { iata:'MIA', icao:'KMIA', name:'Miami International',  city:'Miami',     country:'US', lat:25.7959, lon:-80.2870},
    { iata:'LAX', icao:'KLAX', name:'Los Angeles Intl',     city:'Los Angeles',country:'US',lat:33.9425, lon:-118.4081},
  ];
  ok(res, airports, { count: airports.length });
});

module.exports = router;
