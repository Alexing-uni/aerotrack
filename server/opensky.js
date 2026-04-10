// ============================================================
//  AeroTrack — OpenSky Network API Service
//  Handles all communication with opensky-network.org
// ============================================================

const axios    = require('axios');
const NodeCache = require('node-cache');

const BASE_URL = 'https://opensky-network.org/api';
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 30;

// In-memory cache to avoid hammering the API
const cache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: 10 });

// ── Auth ────────────────────────────────────────────────────
function getAuthConfig() {
  const id     = process.env.OPENSKY_CLIENT_ID;
  const secret = process.env.OPENSKY_CLIENT_SECRET;
  if (id && secret) {
    return { auth: { username: id, password: secret } };
  }
  return {}; // anonymous
}

// ── Generic cached GET ──────────────────────────────────────
async function openSkyGet(endpoint, params = {}) {
  const cacheKey = endpoint + JSON.stringify(params);
  const cached   = cache.get(cacheKey);
  if (cached !== undefined) {
    console.log(`[CACHE HIT] ${endpoint}`);
    return cached;
  }

  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params,
      timeout: 10000,
      ...getAuthConfig(),
    });
    cache.set(cacheKey, response.data);
    return response.data;
  } catch (err) {
    const status = err.response?.status;
    if (status === 401) throw { status: 401, message: 'Invalid OpenSky credentials. Check your .env file.' };
    if (status === 403) throw { status: 403, message: 'Access denied by OpenSky API.' };
    if (status === 404) throw { status: 404, message: 'Flight not found.' };
    if (status === 429) throw { status: 429, message: 'OpenSky API rate limit reached. Try again later.' };
    throw { status: 502, message: 'OpenSky API unavailable: ' + (err.message || 'unknown error') };
  }
}

// ── Time helpers ────────────────────────────────────────────
function nowUnix()       { return Math.floor(Date.now() / 1000); }
function hoursAgo(h)     { return nowUnix() - h * 3600; }
function hoursAhead(h)   { return nowUnix() + h * 3600; }

// ── ICAO callsign normalizer ─────────────────────────────────
// Users type "IB6250" → ICAO callsign is "IBE6250"
const IATA_TO_ICAO = {
  IB: 'IBE', VY: 'VLG', FR: 'RYR', U2: 'EZY', LH: 'DLH',
  AA: 'AAL', BA: 'BAW', AF: 'AFR', KL: 'KLM', LX: 'SWR',
  UX: 'AEA', I2: 'IBS', VB: 'VIV', W6: 'WZZ', TP: 'TAP',
  AZ: 'AZA', SK: 'SAS', OS: 'AUA', SN: 'BEL', BT: 'BTI',
  EI: 'EIN', TK: 'THY', SU: 'AFL', EK: 'UAE', QR: 'QTR',
};

function toIcaoCallsign(input) {
  const upper = input.toUpperCase().replace(/\s/g, '');
  const prefix = upper.slice(0, 2);
  const num    = upper.slice(2);
  return IATA_TO_ICAO[prefix] ? IATA_TO_ICAO[prefix] + num : upper;
}

// ── Parse raw OpenSky state vector ──────────────────────────
function parseStateVector(state) {
  if (!state) return null;
  return {
    icao24:     state[0],
    callsign:   (state[1] || '').trim(),
    origin_country: state[2],
    time_position:  state[3],
    last_contact:   state[4],
    longitude:  state[5],
    latitude:   state[6],
    geo_altitude: state[7],  // meters
    on_ground:  state[8],
    velocity:   state[9],    // m/s
    heading:    state[10],
    vertical_rate: state[11],
    baro_altitude: state[13], // meters
    squawk:     state[14],
    spi:        state[15],
    position_source: state[16],
  };
}

// ── Format flight for API response ──────────────────────────
function formatFlight(raw) {
  if (!raw) return null;
  return {
    icao24:        raw.icao24,
    callsign:      (raw.callsign || '').trim(),
    origin_country: raw.origin_country,
    latitude:      raw.latitude,
    longitude:     raw.longitude,
    altitude_m:    raw.baro_altitude || raw.geo_altitude,
    altitude_ft:   raw.baro_altitude ? Math.round(raw.baro_altitude * 3.28084) : null,
    on_ground:     raw.on_ground,
    velocity_ms:   raw.velocity,
    velocity_kmh:  raw.velocity ? Math.round(raw.velocity * 3.6) : null,
    velocity_kts:  raw.velocity ? Math.round(raw.velocity * 1.944) : null,
    heading:       raw.heading,
    vertical_rate: raw.vertical_rate,
    squawk:        raw.squawk,
    last_contact:  raw.last_contact,
    status:        raw.on_ground ? 'on_ground' : 'airborne',
  };
}

// ── Public API Methods ───────────────────────────────────────

/**
 * Get live state of a specific flight by callsign
 * @param {string} callsign - e.g. "IBE6250" or "IB6250"
 */
async function getFlightByCallsign(callsign) {
  const icao = toIcaoCallsign(callsign);
  const data  = await openSkyGet('/states/all', { time: 0 });

  if (!data || !data.states) return null;

  // Search by callsign (padded to 8 chars in OpenSky)
  const match = data.states.find(s => {
    const cs = (s[1] || '').trim().toUpperCase();
    return cs === icao || cs === callsign.toUpperCase();
  });

  return match ? formatFlight(parseStateVector(match)) : null;
}

/**
 * Get all flights currently in the air (optional bounding box)
 * @param {object} bbox - { lamin, lomin, lamax, lomax }
 */
async function getLiveFlights(bbox = null) {
  const params = bbox ? bbox : {};
  const data   = await openSkyGet('/states/all', params);
  if (!data || !data.states) return [];
  return data.states
    .map(s => formatFlight(parseStateVector(s)))
    .filter(f => f && f.callsign)
    .slice(0, 200); // cap for performance
}

/**
 * Get recent departures from an airport (last 2 hours)
 * @param {string} icaoAirport - e.g. "LEMD" for Madrid
 */
async function getDepartures(icaoAirport) {
  const end   = nowUnix();
  const begin = hoursAgo(2);
  return await openSkyGet('/flights/departure', { airport: icaoAirport, begin, end });
}

/**
 * Get recent arrivals at an airport (last 2 hours)
 * @param {string} icaoAirport - e.g. "LEMD" for Madrid
 */
async function getArrivals(icaoAirport) {
  const end   = nowUnix();
  const begin = hoursAgo(2);
  return await openSkyGet('/flights/arrival', { airport: icaoAirport, begin, end });
}

/**
 * Get flight track (path) for a specific aircraft
 * @param {string} icao24 - hex aircraft identifier
 */
async function getFlightTrack(icao24) {
  return await openSkyGet('/tracks/all', { icao24, time: 0 });
}

module.exports = {
  getFlightByCallsign,
  getLiveFlights,
  getDepartures,
  getArrivals,
  getFlightTrack,
  toIcaoCallsign,
};
