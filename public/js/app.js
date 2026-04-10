/* ============================================================
   AeroTrack — Frontend Application
   ============================================================ */

'use strict';

// ── Config ──────────────────────────────────────────────────
const API_BASE = '/api/flights';

// IATA → ICAO prefix map (for user-friendly input)
const IATA_ICAO = {
  IB:'IBE', VY:'VLG', FR:'RYR', U2:'EZY', LH:'DLH',
  AA:'AAL', BA:'BAW', AF:'AFR', KL:'KLM', UX:'AEA',
  I2:'IBS', LX:'SWR', TP:'TAP', AZ:'AZA', TK:'THY',
  EK:'UAE', QR:'QTR', SK:'SAS', W6:'WZZ',
};

// Common airports shown in quick chips
const QUICK_AIRPORTS = [
  { iata:'MAD', icao:'LEMD', city:'Madrid'    },
  { iata:'BCN', icao:'LEBL', city:'Barcelona' },
  { iata:'PMI', icao:'LEPA', city:'Palma'     },
  { iata:'AGP', icao:'LEMG', city:'Málaga'    },
  { iata:'SVQ', icao:'LEZL', city:'Sevilla'   },
  { iata:'LHR', icao:'EGLL', city:'Londres'   },
  { iata:'CDG', icao:'LFPG', city:'París'     },
  { iata:'FRA', icao:'EDDF', city:'Frankfurt' },
  { iata:'AMS', icao:'EHAM', city:'Amsterdam' },
  { iata:'JFK', icao:'KJFK', city:'New York'  },
];

// ── State ────────────────────────────────────────────────────
const State = {
  selectedAirport:  null,
  activeTab:        'departures',
  flights:          [],
  loading:          false,
  serverMode:       null, // 'authenticated' | 'anonymous'
};

// ── Utils ────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function toIcao(input) {
  const upper  = input.toUpperCase().replace(/\s/g, '');
  const prefix = upper.slice(0, 2);
  const num    = upper.slice(2);
  return IATA_ICAO[prefix] ? IATA_ICAO[prefix] + num : upper;
}

function fmtSpeed(ms)  { return ms  ? `${Math.round(ms * 3.6)} km/h`   : '—'; }
function fmtAlt(m)     { return m   ? `${Math.round(m * 3.281)} ft`     : '—'; }
function fmtHeading(h) { return h != null ? `${Math.round(h)}°`         : '—'; }
function fmtVR(vr)     { return vr  ? `${vr > 0 ? '+' : ''}${Math.round(vr)} m/s` : '—'; }

function compassDir(deg) {
  if (deg == null) return '';
  const dirs = ['N','NE','E','SE','S','SO','O','NO'];
  return dirs[Math.round(deg / 45) % 8];
}

function ago(unix) {
  if (!unix) return '—';
  const s = Math.round(Date.now() / 1000 - unix);
  if (s < 60)  return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.round(s/60)}min`;
  return `hace ${Math.round(s/3600)}h`;
}

// ── API ──────────────────────────────────────────────────────
async function apiFetch(endpoint) {
  const res = await fetch(API_BASE + endpoint);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Toast ────────────────────────────────────────────────────
let toastTimer;
function toast(msg, duration = 2800) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ── Health / Mode badge ──────────────────────────────────────
async function checkHealth() {
  try {
    const r   = await fetch('/api/health');
    const d   = await r.json();
    const badge = $('apiBadge');
    State.serverMode = d.opensky_mode;
    if (d.opensky_mode === 'authenticated') {
      badge.textContent  = '🔐 Auth';
      badge.className    = 'api-badge';
    } else {
      badge.textContent  = '👤 Anon';
      badge.className    = 'api-badge anon';
    }
  } catch {
    $('apiBadge').textContent = '⚠ offline';
  }
}

// ── Render airports ──────────────────────────────────────────
function renderAirports() {
  const el = $('airportScroll');
  el.innerHTML = QUICK_AIRPORTS.map(a => `
    <div class="airport-chip" data-icao="${a.icao}" onclick="App.selectAirport('${a.iata}','${a.icao}',this)">
      <span class="code">${a.iata}</span>
      <span class="city">${a.city}</span>
    </div>
  `).join('');
}

// ── Select airport ───────────────────────────────────────────
function selectAirport(iata, icao, el) {
  document.querySelectorAll('.airport-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  State.selectedAirport = { iata, icao };
  loadFlights();
}

// ── Load flights ─────────────────────────────────────────────
async function loadFlights() {
  if (State.loading) return;
  if (!State.selectedAirport && State.activeTab !== 'live') {
    renderEmpty('Selecciona un aeropuerto arriba para ver vuelos.', '🏢');
    return;
  }

  State.loading = true;
  renderLoading();

  try {
    let endpoint, title;

    if (State.activeTab === 'live') {
      endpoint = '/live';
      title    = '🌍 Vuelos en el aire ahora';
    } else if (State.activeTab === 'departures') {
      endpoint = `/departures/${State.selectedAirport.icao}`;
      title    = `✈ Salidas · ${State.selectedAirport.iata}`;
    } else {
      endpoint = `/arrivals/${State.selectedAirport.icao}`;
      title    = `⬇ Llegadas · ${State.selectedAirport.iata}`;
    }

    const res = await apiFetch(endpoint);
    State.flights = res.data || [];
    $('listTitle').textContent = title;

    if (!State.flights.length) {
      renderEmpty('No hay vuelos disponibles en este momento. Intenta de nuevo.', '✈');
    } else {
      renderFlights(State.flights);
    }
  } catch (err) {
    renderError(err.message);
  } finally {
    State.loading = false;
  }
}

// ── Render helpers ───────────────────────────────────────────
function renderLoading() {
  $('flightList').innerHTML = Array(5).fill('<div class="skeleton"></div>').join('');
}

function renderEmpty(msg, icon = '✈') {
  $('flightList').innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div class="empty-title">Sin resultados</div>
      <div class="empty-sub">${msg}</div>
    </div>`;
}

function renderError(msg) {
  $('flightList').innerHTML = `
    <div class="error-state">
      ⚠ ${msg}<br><small>Si el problema persiste, revisa tu conexión o credenciales en el servidor.</small>
    </div>`;
}

// ── Render live flight row (from /states/all) ────────────────
function renderFlightRow(f) {
  // Departures/arrivals use different shape from OpenSky
  const isState  = f.velocity_kmh !== undefined;
  const callsign = f.callsign || f.estDepartureAirport || '—';
  const status   = isState ? (f.status || 'unknown') : 'airborne';
  const statusLabel = status === 'airborne' ? 'En vuelo' : status === 'on_ground' ? 'En tierra' : '—';

  if (isState) {
    // Live state vector
    return `
    <div class="flight-row ${status}" onclick="App.openFlightModal(${JSON.stringify(f).replace(/"/g,'&quot;')})">
      <div class="flight-row-inner">
        <div class="flight-row-top">
          <div>
            <div class="flight-callsign">${callsign}</div>
            <div class="flight-country">${f.origin_country || '—'}</div>
          </div>
          <div class="flight-status-badge ${status}">${statusLabel}</div>
        </div>
        <div class="flight-row-stats">
          <div class="stat-item">
            <span class="stat-label">Velocidad</span>
            <span class="stat-value accent">${fmtSpeed(f.velocity_ms)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Altitud</span>
            <span class="stat-value">${fmtAlt(f.altitude_m)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Rumbo</span>
            <span class="stat-value">${fmtHeading(f.heading)} ${compassDir(f.heading)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Contacto</span>
            <span class="stat-value">${ago(f.last_contact)}</span>
          </div>
        </div>
      </div>
    </div>`;
  } else {
    // Departure/arrival from OpenSky flights endpoint
    const dep = f.estDepartureAirport || '?';
    const arr = f.estArrivalAirport   || '?';
    const cs  = (f.callsign || '').trim() || f.icao24 || '—';
    return `
    <div class="flight-row airborne" onclick="App.openDepArrModal(${JSON.stringify(f).replace(/"/g,'&quot;')})">
      <div class="flight-row-inner">
        <div class="flight-row-top">
          <div>
            <div class="flight-callsign">${cs}</div>
            <div class="flight-country">${dep} → ${arr}</div>
          </div>
          <div class="flight-status-badge airborne">Activo</div>
        </div>
        <div class="flight-row-stats">
          <div class="stat-item">
            <span class="stat-label">ICAO24</span>
            <span class="stat-value accent">${f.icao24 || '—'}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Origen</span>
            <span class="stat-value">${dep}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Destino</span>
            <span class="stat-value">${arr}</span>
          </div>
        </div>
      </div>
    </div>`;
  }
}

function renderFlights(flights) {
  if (!flights.length) { renderEmpty('No hay vuelos.'); return; }
  $('flightList').innerHTML = flights.slice(0, 80).map(renderFlightRow).join('');
}

// ── Search ───────────────────────────────────────────────────
async function search() {
  const raw = $('searchInput').value.trim();
  if (!raw || raw.length < 3) { toast('Introduce al menos 3 caracteres'); return; }

  const btn  = $('searchBtn');
  btn.disabled   = true;
  btn.textContent = '…';

  const resultCard = $('resultCard');
  resultCard.style.display = 'block';
  resultCard.innerHTML = `<div class="result-label"><span class="spin"></span>Buscando ${raw.toUpperCase()}…</div>`;

  try {
    const icao = toIcao(raw);
    const res  = await apiFetch(`/search?q=${encodeURIComponent(icao)}`);
    const f    = res.data;
    showSearchResult(f, raw.toUpperCase());
  } catch (err) {
    resultCard.innerHTML = `
      <div class="result-label">✦ Resultado</div>
      <div class="error-state" style="margin:0">${err.message}</div>`;
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Buscar';
  }
}

function showSearchResult(f, query) {
  const el = $('resultCard');
  el.style.display = 'block';
  el.innerHTML = `
    <div class="result-label">✦ Vuelo encontrado</div>
    <div class="flight-callsign">${f.callsign || query}</div>
    <div class="status-row" style="margin-top:8px">
      <span class="badge ${f.status}">${f.status === 'airborne' ? '✈ En vuelo' : '🛬 En tierra'}</span>
      <span class="text-muted" style="font-size:11px">${f.origin_country || ''}</span>
    </div>
    <div class="detail-grid">
      <div class="detail-item"><div class="label">Velocidad</div><div class="value text-accent">${fmtSpeed(f.velocity_ms)}</div></div>
      <div class="detail-item"><div class="label">Altitud</div><div class="value">${fmtAlt(f.altitude_m)}</div></div>
      <div class="detail-item"><div class="label">Rumbo</div><div class="value">${fmtHeading(f.heading)} ${compassDir(f.heading)}</div></div>
      <div class="detail-item"><div class="label">Vel. vertical</div><div class="value">${fmtVR(f.vertical_rate)}</div></div>
      <div class="detail-item"><div class="label">ICAO24</div><div class="value text-accent">${f.icao24 || '—'}</div></div>
      <div class="detail-item"><div class="label">Squawk</div><div class="value">${f.squawk || '—'}</div></div>
    </div>
    <div style="margin-top:12px;font-size:10px;color:var(--muted)">Último contacto: ${ago(f.last_contact)}</div>`;
}

// ── Modals ───────────────────────────────────────────────────
function openFlightModal(f) {
  const headingDeg  = f.heading ? Math.round(f.heading) : 0;
  const statusClass = f.status === 'airborne' ? 'ok' : 'muted';
  const statusLabel = f.status === 'airborne' ? '✈ En vuelo' : '🛬 En tierra';

  $('modalBody').innerHTML = `
    <div class="modal-header">
      <div class="modal-close-row"><div class="modal-close" onclick="App.closeModal()">✕</div></div>
      <div class="modal-callsign">${f.callsign || f.icao24 || '—'}</div>
      <div class="modal-sub">${f.origin_country || ''} · ICAO24: ${f.icao24 || '—'}</div>
    </div>
    <div class="modal-map">
      <div class="modal-map-plane" style="transform:translate(-50%,-50%) rotate(${headingDeg}deg)">✈</div>
      <div class="heading-arrow">${compassDir(f.heading)}</div>
      <div class="modal-map-label">Posición en tiempo real · OpenSky Network</div>
    </div>
    <div class="info-grid">
      <div class="info-cell"><div class="info-label">Estado</div><div class="info-value ${statusClass}">${statusLabel}</div></div>
      <div class="info-cell"><div class="info-label">País origen</div><div class="info-value">${f.origin_country || '—'}</div></div>
      <div class="info-cell"><div class="info-label">Velocidad</div><div class="info-value accent">${fmtSpeed(f.velocity_ms)}</div></div>
      <div class="info-cell"><div class="info-label">Vel. kts</div><div class="info-value">${f.velocity_kts ? f.velocity_kts + ' kts' : '—'}</div></div>
      <div class="info-cell"><div class="info-label">Altitud</div><div class="info-value">${fmtAlt(f.altitude_m)}</div></div>
      <div class="info-cell"><div class="info-label">Altitud barom.</div><div class="info-value">${f.altitude_m ? Math.round(f.altitude_m) + ' m' : '—'}</div></div>
      <div class="info-cell"><div class="info-label">Rumbo</div><div class="info-value">${fmtHeading(f.heading)} ${compassDir(f.heading)}</div></div>
      <div class="info-cell"><div class="info-label">Vel. vertical</div><div class="info-value">${fmtVR(f.vertical_rate)}</div></div>
      <div class="info-cell"><div class="info-label">Lat / Lon</div><div class="info-value" style="font-size:11px">${f.latitude?.toFixed(3) ?? '—'} / ${f.longitude?.toFixed(3) ?? '—'}</div></div>
      <div class="info-cell"><div class="info-label">Squawk</div><div class="info-value">${f.squawk || '—'}</div></div>
      <div class="info-cell"><div class="info-label">ICAO24</div><div class="info-value accent">${f.icao24 || '—'}</div></div>
      <div class="info-cell"><div class="info-label">Contacto</div><div class="info-value">${ago(f.last_contact)}</div></div>
    </div>
    <div class="modal-actions">
      <div class="modal-action primary" onclick="App.copyCoords(${f.latitude},${f.longitude})">
        <span class="modal-action-icon">📍</span>Copiar pos.
      </div>
      <div class="modal-action" onclick="App.openFlightradar('${f.callsign || f.icao24}')">
        <span class="modal-action-icon">🌐</span>Flightradar
      </div>
      <div class="modal-action" onclick="App.shareFlightInfo('${f.callsign || f.icao24}',${f.latitude},${f.longitude})">
        <span class="modal-action-icon">↑</span>Compartir
      </div>
    </div>`;

  $('modalOverlay').classList.add('open');
  $('modal').classList.add('open');
}

function openDepArrModal(f) {
  const cs = (f.callsign || '').trim() || f.icao24;
  const dep = f.estDepartureAirport || '—';
  const arr = f.estArrivalAirport   || '—';

  $('modalBody').innerHTML = `
    <div class="modal-header">
      <div class="modal-close-row"><div class="modal-close" onclick="App.closeModal()">✕</div></div>
      <div class="modal-callsign">${cs}</div>
      <div class="modal-sub">${dep} → ${arr}</div>
    </div>
    <div class="modal-map">
      <div class="modal-map-plane">✈</div>
      <div class="modal-map-label">${dep} → ${arr}</div>
    </div>
    <div class="info-grid">
      <div class="info-cell"><div class="info-label">Callsign</div><div class="info-value accent">${cs}</div></div>
      <div class="info-cell"><div class="info-label">ICAO24</div><div class="info-value">${f.icao24 || '—'}</div></div>
      <div class="info-cell"><div class="info-label">Origen</div><div class="info-value">${dep}</div></div>
      <div class="info-cell"><div class="info-label">Destino</div><div class="info-value">${arr}</div></div>
      <div class="info-cell"><div class="info-label">Salida est.</div><div class="info-value">${f.firstSeen ? new Date(f.firstSeen*1000).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : '—'}</div></div>
      <div class="info-cell"><div class="info-label">Llegada est.</div><div class="info-value">${f.lastSeen ? new Date(f.lastSeen*1000).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : '—'}</div></div>
    </div>
    <div class="modal-actions">
      <div class="modal-action primary" onclick="App.openFlightradar('${cs}')">
        <span class="modal-action-icon">🌐</span>Flightradar
      </div>
      <div class="modal-action" onclick="App.shareFlightInfo('${cs}','','')">
        <span class="modal-action-icon">↑</span>Compartir
      </div>
    </div>`;

  $('modalOverlay').classList.add('open');
  $('modal').classList.add('open');
}

function closeModal() {
  $('modalOverlay').classList.remove('open');
  $('modal').classList.remove('open');
}

// ── Actions ──────────────────────────────────────────────────
function copyCoords(lat, lon) {
  const txt = `${lat?.toFixed(5)}, ${lon?.toFixed(5)}`;
  navigator.clipboard?.writeText(txt).then(() => toast('📍 Coordenadas copiadas'));
}

function openFlightradar(callsign) {
  window.open(`https://www.flightradar24.com/${callsign}`, '_blank');
}

function shareFlightInfo(callsign, lat, lon) {
  const text = `✈ Vuelo ${callsign} en tiempo real${lat ? ` · ${lat?.toFixed(3)}, ${lon?.toFixed(3)}` : ''}`;
  if (navigator.share) {
    navigator.share({ title: `AeroTrack · ${callsign}`, text });
  } else {
    navigator.clipboard?.writeText(text).then(() => toast('Copiado al portapapeles'));
  }
}

// ── Tab switch ───────────────────────────────────────────────
function switchTab(el, tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  State.activeTab = tab;
  loadFlights();
}

// ── Nav ──────────────────────────────────────────────────────
function navTo(section, el) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  if (section === 'settings') showSettings();
  if (section === 'map')      toast('🗺 Mapa próximamente');
}

function focusSearch() {
  $('searchInput').focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSettings() {
  const mode = State.serverMode === 'authenticated' ? '🔐 Autenticado' : '👤 Anónimo';
  alert(
    `⚙️ AeroTrack — Configuración\n\n` +
    `Servidor: ${window.location.host}\n` +
    `OpenSky: ${mode}\n\n` +
    `Para cambiar credenciales edita el archivo .env en el servidor y reinicia.\n` +
    `Docs: opensky-network.org/my-opensky/account`
  );
}

function refresh() {
  toast('↺ Actualizando…');
  checkHealth();
  if (State.selectedAirport || State.activeTab === 'live') loadFlights();
}

// ── Init ─────────────────────────────────────────────────────
const App = {
  search, selectAirport, switchTab, loadFlights,
  openFlightModal, openDepArrModal, closeModal,
  copyCoords, openFlightradar, shareFlightInfo,
  navTo, focusSearch, refresh,
};

(async function init() {
  renderAirports();
  await checkHealth();

  // Enter key on search
  $('searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') search();
  });

  // Auto-select Madrid on load
  const madridChip = document.querySelector('.airport-chip[data-icao="LEMD"]');
  if (madridChip) selectAirport('MAD', 'LEMD', madridChip);
})();
