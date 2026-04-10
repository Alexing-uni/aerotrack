// ============================================================
//  AeroTrack — API Test Script
//  Run: node server/test-api.js
// ============================================================

require('dotenv').config();
const axios = require('axios');

const BASE = `http://localhost:${process.env.PORT || 3000}`;

async function test(label, url) {
  try {
    const r = await axios.get(url, { timeout: 10000 });
    const data = r.data;
    console.log(`✅  ${label}`);
    if (data.count !== undefined) console.log(`    → ${data.count} results`);
    if (data.data?.callsign) console.log(`    → Callsign: ${data.data.callsign}, Status: ${data.data.status}`);
    return true;
  } catch (e) {
    const msg = e.response?.data?.error || e.message;
    console.log(`❌  ${label}: ${msg}`);
    return false;
  }
}

(async () => {
  console.log('\n🛫  AeroTrack API Tests\n' + '─'.repeat(40));

  await test('Health check',       `${BASE}/api/health`);
  await test('Airports list',      `${BASE}/api/flights/airports`);
  await test('Live flights',       `${BASE}/api/flights/live`);
  await test('Departures LEMD',    `${BASE}/api/flights/departures/LEMD`);
  await test('Arrivals LEMD',      `${BASE}/api/flights/arrivals/LEMD`);
  await test('Search IBE6250',     `${BASE}/api/flights/search?q=IBE6250`);

  console.log('\n' + '─'.repeat(40));
  console.log('Tests complete.\n');
})();
