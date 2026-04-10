/* ============================================================
   AeroTrack — Frontend (reescrito limpio)
   ============================================================ */
'use strict';

/* ── DOM helper — definido PRIMERO para evitar errores ──────── */
var $ = function(id) { return document.getElementById(id); };

/* ── Configuración ──────────────────────────────────────────── */
var API_BASE        = '/api/flights';
var AUTO_REFRESH_MS = 30000; // 30 segundos — sin separador numérico

/* ── IATA → ICAO callsign ────────────────────────────────────  */
var IATA_ICAO = {
  IB:'IBE', VY:'VLG', FR:'RYR', U2:'EZY', LH:'DLH',
  AA:'AAL', BA:'BAW', AF:'AFR', KL:'KLM', UX:'AEA',
  I2:'IBS', LX:'SWR', TP:'TAP', AZ:'AZA', TK:'THY',
  EK:'UAE', QR:'QTR', SK:'SAS', W6:'WZZ', DY:'NAX',
};

/* ── Aeropuertos en chips rápidos ───────────────────────────── */
var QUICK_AIRPORTS = [
  { iata:'MAD', icao:'LEMD', city:'Madrid'    },
  { iata:'BCN', icao:'LEBL', city:'Barcelona' },
  { iata:'PMI', icao:'LEPA', city:'Palma'     },
  { iata:'AGP', icao:'LEMG', city:'Málaga'    },
  { iata:'SVQ', icao:'LEZL', city:'Sevilla'   },
  { iata:'LHR', icao:'EGLL', city:'Londres'   },
  { iata:'CDG', icao:'LFPG', city:'París'     },
  { iata:'FRA', icao:'EDDF', city:'Frankfurt' },
  { iata:'AMS', icao:'EHAM', city:'Ámsterdam' },
  { iata:'JFK', icao:'KJFK', city:'New York'  },
];

/* ── Código ICAO de aeropuerto → nombre legible ─────────────── */
var ICAO_AIRPORTS = {
  // España
  LEMD:'Madrid',      LEBL:'Barcelona',   LEPA:'Palma',
  LEMG:'Málaga',      LEAL:'Alicante',    LEZL:'Sevilla',
  LEVC:'Valencia',    LEIB:'Ibiza',       LEMH:'Menorca',
  LEBB:'Bilbao',      LESO:'S.Sebastián', LEGE:'Girona',
  LERS:'Reus',        LEGR:'Granada',     LEAM:'Almería',
  GCFV:'Fuerteventura',GCLP:'Las Palmas', GCTS:'Tenerife Sur',
  GCXO:'Tenerife Nte',GCRR:'Lanzarote',  GCLA:'La Palma',
  // Europa
  EGLL:'Londres',     EGKK:'Londres Gatwick',EGSS:'Londres Stansted',
  LFPG:'París CDG',   LFPO:'París Orly',  EDDF:'Frankfurt',
  EDDM:'Múnich',      EHAM:'Ámsterdam',   LIRF:'Roma',
  LSZH:'Zúrich',      LSGG:'Ginebra',     LFMN:'Niza',
  ESSA:'Estocolmo',   ENGM:'Oslo',        EKCH:'Copenhague',
  EFHK:'Helsinki',    EPWA:'Varsovia',    LKPR:'Praga',
  LOWW:'Viena',       LHBP:'Budapest',    LPPT:'Lisboa',
  LPPR:'Oporto',      LGAV:'Atenas',      LTFM:'Estambul',
  EBBR:'Bruselas',    EIDW:'Dublín',      UUEE:'Moscú',
  // América
  KJFK:'Nueva York',  KLAX:'Los Ángeles', KMIA:'Miami',
  KORD:'Chicago',     KATL:'Atlanta',     KDFW:'Dallas',
  KBOS:'Boston',      KSFO:'San Francisco',KLAS:'Las Vegas',
  CYYZ:'Toronto',     MMMX:'Ciudad de México',
  // Resto
  OMDB:'Dubai',       VHHH:'Hong Kong',   RJTT:'Tokio',
  ZBAA:'Pekín',       YSSY:'Sídney',      WSSS:'Singapur',
  OMAA:'Abu Dabi',    OERK:'Riad',        HECA:'El Cairo',
};

/* ── Código ICAO de aerolínea → nombre ──────────────────────── */
var AIRLINES = {
  RYR:'Ryanair',        IBE:'Iberia',          VLG:'Vueling',
  AEA:'Air Europa',     IBS:'Iberia Express',  EZY:'easyJet',
  DLH:'Lufthansa',      AAL:'American',        BAW:'British Airways',
  AFR:'Air France',     KLM:'KLM',             SWR:'Swiss',
  TAP:'TAP Portugal',   AZA:'ITA Airways',     THY:'Turkish Airlines',
  UAE:'Emirates',       QTR:'Qatar Airways',   SAS:'Scandinavian',
  WZZ:'Wizz Air',       NAX:'Norwegian',       DAL:'Delta',
  UAL:'United',         EIN:'Aer Lingus',      BEL:'Brussels Airlines',
  BTI:'airBaltic',      AUA:'Austrian',        AFL:'Aeroflot',
  RAM:'Royal Air Maroc',MSR:'Egyptair',        ETH:'Ethiopian',
  SVA:'Saudia',         QFA:'Qantas',          SIA:'Singapore',
  CPA:'Cathay Pacific', JAL:'Japan Airlines',  ANA:'All Nippon',
};

/* ── Colores de aerolínea (marca) ────────────────────────────── */
var AIRLINE_COLORS = {
  RYR:'#073590', IBE:'#d40000', VLG:'#ffcd00', AEA:'#003087',
  IBS:'#e0001b', EZY:'#FF6600', DLH:'#05164d', AAL:'#0078d2',
  BAW:'#2b5fad', AFR:'#002157', KLM:'#009ada', SWR:'#b00000',
  TAP:'#C8102E', AZA:'#006DB7', THY:'#E81932', UAE:'#c60c30',
  QTR:'#5C0632', SAS:'#005FA8', WZZ:'#c6007e', NAX:'#d71920',
  DAL:'#e01933', UAL:'#002244', EIN:'#007DC6', BEL:'#1e30a3',
};

/* ── Estado ──────────────────────────────────────────────────── */
var State = {
  selectedAirport: null,
  activeTab: 'departures',
  flights: [],
  loading: false,
  serverMode: null,
};

/* ── Timers para auto-refresh ────────────────────────────────── */
var _refreshTimer = null;
var _tickTimer    = null;
var _lastLoad     = null;

/* ── Utilidades ─────────────────────────────────────────────── */

function airportName(icao) {
  if (!icao || icao === '?') return '?';
  return ICAO_AIRPORTS[icao] || icao;
}

function airlineFromCallsign(cs) {
  if (!cs) return null;
  var prefix = cs.trim().replace(/\d[\w\d]*$/, '').toUpperCase();
  return AIRLINES[prefix] || null;
}

function airlineColor(cs) {
  if (!cs) return '#00d4ff';
  var prefix = cs.trim().replace(/\d[\w\d]*$/, '').toUpperCase();
  return AIRLINE_COLORS[prefix] || '#00d4ff';
}

function toIcao(input) {
  var upper  = input.toUpperCase().replace(/\s/g, '');
  var prefix = upper.slice(0, 2);
  var num    = upper.slice(2);
  return IATA_ICAO[prefix] ? IATA_ICAO[prefix] + num : upper;
}

function fmtSpeed(ms)  { return ms   ? Math.round(ms * 3.6) + ' km/h'  : '—'; }
function fmtAlt(m)     { return m    ? Math.round(m * 3.281) + ' ft'    : '—'; }
function fmtHeading(h) { return h != null ? Math.round(h) + '°'         : '—'; }
function fmtVR(vr)     { return vr   ? (vr > 0 ? '+' : '') + Math.round(vr) + ' m/s' : '—'; }

function compassDir(deg) {
  if (deg == null) return '';
  var dirs = ['N','NE','E','SE','S','SO','O','NO'];
  return dirs[Math.round(deg / 45) % 8];
}

function ago(unix) {
  if (!unix) return '—';
  var s = Math.round(Date.now() / 1000 - unix);
  if (s < 60)   return 'hace ' + s + 's';
  if (s < 3600) return 'hace ' + Math.round(s / 60) + 'min';
  return 'hace ' + Math.round(s / 3600) + 'h';
}

function fmtTime(unix) {
  if (!unix) return '—';
  return new Date(unix * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

/* ── Auto-refresh ────────────────────────────────────────────── */

function startAutoRefresh() {
  clearInterval(_refreshTimer);
  clearInterval(_tickTimer);
  _lastLoad = Date.now();
  _tickTimer = setInterval(updateRefreshBadge, 1000);
  _refreshTimer = setInterval(function() {
    if (State.selectedAirport || State.activeTab === 'live') loadFlights();
  }, AUTO_REFRESH_MS);
  updateRefreshBadge();
}

function stopAutoRefresh() {
  clearInterval(_refreshTimer);
  clearInterval(_tickTimer);
  _refreshTimer = null;
  _tickTimer    = null;
  _lastLoad     = null;
  var el = $('refreshBadge');
  if (el) { el.textContent = ''; el.className = 'refresh-badge'; }
}

function updateRefreshBadge() {
  var el = $('refreshBadge');
  if (!el || !_lastLoad) return;
  var elapsed   = Math.floor((Date.now() - _lastLoad) / 1000);
  var remaining = Math.max(0, Math.ceil(AUTO_REFRESH_MS / 1000) - elapsed);
  el.textContent = '\u21BA ' + remaining + 's';
  el.className = 'refresh-badge' + (remaining <= 5 ? ' soon' : '');
}

/* ── API ─────────────────────────────────────────────────────── */

async function apiFetch(endpoint) {
  var res = await fetch(API_BASE + endpoint);
  if (!res.ok) {
    var err = await res.json().catch(function() { return {}; });
    throw new Error(err.error || 'HTTP ' + res.status);
  }
  return res.json();
}

/* ── Toast ───────────────────────────────────────────────────── */
var _toastTimer;
function toast(msg, duration) {
  var el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() { el.classList.remove('show'); }, duration || 2800);
}

/* ── Health check + badge ────────────────────────────────────── */
async function checkHealth() {
  try {
    var r    = await fetch('/api/health');
    var d    = await r.json();
    var badge = $('apiBadge');
    State.serverMode = d.opensky_mode;
    if (badge) {
      badge.textContent = d.opensky_mode === 'authenticated' ? 'Auth' : 'Anon';
      badge.className   = 'api-badge' + (d.opensky_mode === 'authenticated' ? '' : ' anon');
    }
  } catch {
    var b = $('apiBadge');
    if (b) { b.textContent = 'Offline'; b.className = 'api-badge anon'; }
  }
}

/* ── Contador global de vuelos ───────────────────────────────── */
async function fetchGlobalCount() {
  try {
    var r  = await fetch('/api/flights/live');
    var d  = await r.json();
    var el = $('liveCounter');
    if (el && d.count) {
      el.textContent = '\uD83C\uDF0D ' + Number(d.count).toLocaleString('es-ES') + ' en vuelo';
      el.style.display = 'inline-flex';
    }
  } catch { /* silencioso */ }
}

/* ── Render de chips de aeropuertos ─────────────────────────── */
function renderAirports() {
  var el = $('airportScroll');
  if (!el) return;
  el.innerHTML = QUICK_AIRPORTS.map(function(a) {
    return '<div class="airport-chip" data-icao="' + a.icao + '" onclick="App.selectAirport(\'' + a.iata + '\',\'' + a.icao + '\',this)">' +
      '<span class="code">' + a.iata + '</span>' +
      '<span class="city">' + a.city + '</span>' +
    '</div>';
  }).join('');
}

/* ── Seleccionar aeropuerto ──────────────────────────────────── */
function selectAirport(iata, icao, el) {
  document.querySelectorAll('.airport-chip').forEach(function(c) { c.classList.remove('active'); });
  if (el) el.classList.add('active');
  State.selectedAirport = { iata: iata, icao: icao };
  loadFlights();
}

/* ── Cargar vuelos ───────────────────────────────────────────── */
async function loadFlights() {
  if (State.loading) return;

  if (!State.selectedAirport && State.activeTab !== 'live') {
    stopAutoRefresh();
    renderEmpty('Selecciona un aeropuerto para ver vuelos.', '\uD83C\uDFE2');
    return;
  }

  State.loading = true;
  renderLoading();

  try {
    var endpoint, title;

    if (State.activeTab === 'live') {
      endpoint = '/live';
      title    = '\uD83C\uDF0D Vuelos en el aire ahora';
    } else if (State.activeTab === 'departures') {
      endpoint = '/departures/' + State.selectedAirport.icao;
      title    = '\u2708 Salidas \u00B7 ' + State.selectedAirport.iata;
    } else {
      endpoint = '/arrivals/' + State.selectedAirport.icao;
      title    = '\u2B07 Llegadas \u00B7 ' + State.selectedAirport.iata;
    }

    var res = await apiFetch(endpoint);
    State.flights = res.data || [];

    var titleEl = $('listTitle');
    if (titleEl) titleEl.textContent = title;

    if (!State.flights.length) {
      renderEmpty('Sin vuelos en este momento. OpenSky puede tener datos limitados para este aeropuerto.', '\u2708');
    } else {
      renderFlights(State.flights);
    }
  } catch (err) {
    renderError(err.message);
  } finally {
    State.loading = false;
    startAutoRefresh();
  }
}

/* ── Helpers de render ───────────────────────────────────────── */

function renderLoading() {
  var thead = $('boardHead');
  if (thead) thead.style.display = 'none';
  var list = $('flightList');
  if (!list) return;
  list.innerHTML = [0,1,2,3,4].map(function() {
    return '<div class="skeleton"></div>';
  }).join('');
}

function renderEmpty(msg, icon) {
  var thead = $('boardHead');
  if (thead) thead.style.display = 'none';
  var list = $('flightList');
  if (!list) return;
  list.innerHTML = '<div class="empty-state">' +
    '<div class="empty-icon">' + (icon || '\u2708') + '</div>' +
    '<div class="empty-title">Sin resultados</div>' +
    '<div class="empty-sub">' + msg + '</div>' +
    '</div>';
}

function renderError(msg) {
  var thead = $('boardHead');
  if (thead) thead.style.display = 'none';
  var list = $('flightList');
  if (!list) return;
  list.innerHTML = '<div class="error-state">' +
    '\u26A0 ' + msg + '<br><small>Comprueba que el servidor est\u00E9 arrancado (npm run dev) y hay conexi\u00F3n a internet.</small>' +
    '</div>';
}

/* ── Render fila del tablero ─────────────────────────────────── */

function renderFlightRow(f) {
  var isDepArr = (f.estDepartureAirport !== undefined || f.estArrivalAirport !== undefined);
  var cs       = ((f.callsign || '').trim()) || (f.icao24 || '—');
  var airline  = airlineFromCallsign(cs);
  var color    = airlineColor(cs);

  // Escapar datos para onclick inline
  var fData = JSON.stringify(f).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  if (isDepArr) {
    var depIcao = f.estDepartureAirport || '?';
    var arrIcao = f.estArrivalAirport   || '?';
    var dep     = airportName(depIcao);
    var arr     = airportName(arrIcao);
    var time    = fmtTime(f.firstSeen);

    return '<div class="brow" onclick="App.openDepArrModal(' + fData + ')">' +
      '<div class="bc1">' +
        '<div class="bcs" style="color:' + color + '">' + esc(cs) + '</div>' +
        '<div class="bal">' + esc(airline || '—') + '</div>' +
      '</div>' +
      '<div class="bc2">' +
        '<div class="brt">' + esc(dep) + ' <span class="barr">\u2192</span> ' + esc(arr) + '</div>' +
        '<div class="brc">' + esc(depIcao) + ' \u2192 ' + esc(arrIcao) + '</div>' +
      '</div>' +
      '<div class="bc3">' + time + '</div>' +
      '<div class="bc4"><span class="bst ok">\u2708</span></div>' +
    '</div>';

  } else {
    var speed = f.velocity_ms ? Math.round(f.velocity_ms * 3.6) + ' km/h' : '—';
    var alt   = f.altitude_m  ? Math.round(f.altitude_m * 3.281 / 1000) + ' kft' : '—';
    var isGnd = (f.status === 'on_ground');
    var rowClass = 'brow' + (isGnd ? ' gnd' : '');
    var contact = ago(f.last_contact);

    return '<div class="' + rowClass + '" onclick="App.openFlightModal(' + fData + ')">' +
      '<div class="bc1">' +
        '<div class="bcs" style="color:' + color + '">' + esc(cs) + '</div>' +
        '<div class="bal">' + esc(airline || f.origin_country || '—') + '</div>' +
      '</div>' +
      '<div class="bc2">' +
        '<div class="brt">' + esc(f.origin_country || '—') + '</div>' +
        '<div class="brc">' + speed + ' \u00B7 ' + alt + '</div>' +
      '</div>' +
      '<div class="bc3">' + contact + '</div>' +
      '<div class="bc4"><span class="bst ' + (isGnd ? 'gnd' : 'ok') + '">' + (isGnd ? '\u2B07' : '\u2708') + '</span></div>' +
    '</div>';
  }
}

function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderFlights(flights) {
  if (!flights.length) { renderEmpty('Sin vuelos.'); return; }

  var thead = $('boardHead');
  if (thead) thead.style.display = 'grid';

  var list = $('flightList');
  if (!list) return;

  list.classList.remove('refreshed');
  void list.offsetWidth; // reflow para reactivar animación
  list.classList.add('refreshed');
  list.innerHTML = flights.slice(0, 100).map(renderFlightRow).join('');

  // Actualizar contador en cabecera del tablero
  var cntEl = $('boardCount');
  if (cntEl) cntEl.textContent = flights.length + ' vuelos';
}

/* ── Búsqueda ────────────────────────────────────────────────── */
async function search() {
  var raw = $('searchInput').value.trim();
  if (!raw || raw.length < 3) { toast('Introduce al menos 3 caracteres'); return; }

  var btn = $('searchBtn');
  if (btn) { btn.disabled = true; btn.textContent = '\u2026'; }

  var rc = $('resultCard');
  if (rc) {
    rc.style.display = 'block';
    rc.innerHTML = '<div class="result-label"><span class="spin"></span>Buscando ' + raw.toUpperCase() + '\u2026</div>';
  }

  try {
    var icao = toIcao(raw);
    var res  = await apiFetch('/search?q=' + encodeURIComponent(icao));
    showSearchResult(res.data, raw.toUpperCase());
  } catch (err) {
    if (rc) rc.innerHTML = '<div class="result-label">\u2716 Error</div><div class="error-state" style="margin:0">' + err.message + '</div>';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Buscar'; }
  }
}

function showSearchResult(f, query) {
  var el = $('resultCard');
  if (!el) return;
  el.style.display = 'block';
  el.innerHTML =
    '<div class="result-label">\u2756 Vuelo encontrado</div>' +
    '<div class="flight-callsign">' + esc(f.callsign || query) + '</div>' +
    '<div class="status-row" style="margin-top:8px">' +
      '<span class="badge ' + (f.status || '') + '">' + (f.status === 'airborne' ? '\u2708 En vuelo' : '\uD83D\uDEEC En tierra') + '</span>' +
      '<span class="text-muted" style="font-size:11px">' + esc(f.origin_country || '') + '</span>' +
    '</div>' +
    '<div class="detail-grid">' +
      '<div class="detail-item"><div class="label">Velocidad</div><div class="value text-accent">' + fmtSpeed(f.velocity_ms) + '</div></div>' +
      '<div class="detail-item"><div class="label">Altitud</div><div class="value">' + fmtAlt(f.altitude_m) + '</div></div>' +
      '<div class="detail-item"><div class="label">Rumbo</div><div class="value">' + fmtHeading(f.heading) + ' ' + compassDir(f.heading) + '</div></div>' +
      '<div class="detail-item"><div class="label">V. vertical</div><div class="value">' + fmtVR(f.vertical_rate) + '</div></div>' +
      '<div class="detail-item"><div class="label">ICAO24</div><div class="value text-accent">' + esc(f.icao24 || '—') + '</div></div>' +
      '<div class="detail-item"><div class="label">Squawk</div><div class="value">' + esc(f.squawk || '—') + '</div></div>' +
    '</div>' +
    '<div style="margin-top:12px;font-size:10px;color:var(--muted)">Contacto: ' + ago(f.last_contact) + '</div>';
}

/* ── Modal vuelo en vivo ─────────────────────────────────────── */
function openFlightModal(f) {
  var statusClass = f.status === 'airborne' ? 'ok' : 'muted';
  var statusLabel = f.status === 'airborne' ? '\u2708 En vuelo' : '\uD83D\uDEEC En tierra';
  var heading     = f.heading ? Math.round(f.heading) : 0;
  var cs          = esc(f.callsign || f.icao24 || '—');

  $('modalBody').innerHTML =
    '<div class="modal-header">' +
      '<div class="modal-close-row"><div class="modal-close" onclick="App.closeModal()">\u2715</div></div>' +
      '<div class="modal-callsign">' + cs + '</div>' +
      '<div class="modal-sub">' + esc(f.origin_country || '') + ' \u00B7 ICAO24: ' + esc(f.icao24 || '—') + '</div>' +
    '</div>' +
    '<div class="modal-map">' +
      '<div class="modal-map-plane" style="transform:translate(-50%,-50%) rotate(' + heading + 'deg)">\u2708</div>' +
      '<div class="heading-arrow">' + compassDir(f.heading) + '</div>' +
      '<div class="modal-map-label">OpenSky Network · datos en tiempo real</div>' +
    '</div>' +
    '<div class="info-grid">' +
      '<div class="info-cell"><div class="info-label">Estado</div><div class="info-value ' + statusClass + '">' + statusLabel + '</div></div>' +
      '<div class="info-cell"><div class="info-label">Aerolínea</div><div class="info-value">' + esc(airlineFromCallsign(f.callsign || '') || '—') + '</div></div>' +
      '<div class="info-cell"><div class="info-label">Velocidad</div><div class="info-value accent">' + fmtSpeed(f.velocity_ms) + '</div></div>' +
      '<div class="info-cell"><div class="info-label">Nudos</div><div class="info-value">' + (f.velocity_kts ? f.velocity_kts + ' kts' : '—') + '</div></div>' +
      '<div class="info-cell"><div class="info-label">Altitud</div><div class="info-value">' + fmtAlt(f.altitude_m) + '</div></div>' +
      '<div class="info-cell"><div class="info-label">Alt. barom.</div><div class="info-value">' + (f.altitude_m ? Math.round(f.altitude_m) + ' m' : '—') + '</div></div>' +
      '<div class="info-cell"><div class="info-label">Rumbo</div><div class="info-value">' + fmtHeading(f.heading) + ' ' + compassDir(f.heading) + '</div></div>' +
      '<div class="info-cell"><div class="info-label">V. vertical</div><div class="info-value">' + fmtVR(f.vertical_rate) + '</div></div>' +
      '<div class="info-cell"><div class="info-label">País origen</div><div class="info-value">' + esc(f.origin_country || '—') + '</div></div>' +
      '<div class="info-cell"><div class="info-label">Squawk</div><div class="info-value">' + esc(f.squawk || '—') + '</div></div>' +
      '<div class="info-cell"><div class="info-label">ICAO24</div><div class="info-value accent">' + esc(f.icao24 || '—') + '</div></div>' +
      '<div class="info-cell"><div class="info-label">Contacto</div><div class="info-value">' + ago(f.last_contact) + '</div></div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<div class="modal-action primary" onclick="App.copyCoords(' + (f.latitude||0) + ',' + (f.longitude||0) + ')">' +
        '<span class="modal-action-icon">\uD83D\uDCCD</span>Copiar pos.' +
      '</div>' +
      '<div class="modal-action" onclick="App.openFlightradar(\'' + esc(f.callsign || f.icao24) + '\')">' +
        '<span class="modal-action-icon">\uD83C\uDF10</span>Flightradar' +
      '</div>' +
      '<div class="modal-action" onclick="App.shareFlightInfo(\'' + esc(f.callsign || f.icao24) + '\',' + (f.latitude||0) + ',' + (f.longitude||0) + ')">' +
        '<span class="modal-action-icon">\u2191</span>Compartir' +
      '</div>' +
    '</div>';

  $('modalOverlay').classList.add('open');
  $('modal').classList.add('open');
}

/* ── Modal salida/llegada ────────────────────────────────────── */
function openDepArrModal(f) {
  var cs      = ((f.callsign || '').trim()) || f.icao24 || '—';
  var depIcao = f.estDepartureAirport || '—';
  var arrIcao = f.estArrivalAirport   || '—';
  var dep     = airportName(depIcao);
  var arr     = airportName(arrIcao);
  var airline = airlineFromCallsign(cs);
  var depTime = fmtTime(f.firstSeen);
  var arrTime = fmtTime(f.lastSeen);

  $('modalBody').innerHTML =
    '<div class="modal-header">' +
      '<div class="modal-close-row"><div class="modal-close" onclick="App.closeModal()">\u2715</div></div>' +
      '<div class="modal-callsign">' + esc(cs) + '</div>' +
      '<div class="modal-sub">' + esc(airline ? airline + ' \u00B7 ' : '') + esc(dep) + ' \u2192 ' + esc(arr) + '</div>' +
    '</div>' +
    '<div class="modal-map">' +
      '<div class="modal-map-plane">\u2708</div>' +
      '<div class="modal-map-label">' + esc(depIcao) + ' \u2192 ' + esc(arrIcao) + '</div>' +
    '</div>' +
    '<div class="info-grid">' +
      '<div class="info-cell"><div class="info-label">Callsign</div><div class="info-value accent">' + esc(cs) + '</div></div>' +
      '<div class="info-cell"><div class="info-label">Aerolínea</div><div class="info-value">' + esc(airline || '—') + '</div></div>' +
      '<div class="info-cell"><div class="info-label">Origen</div><div class="info-value accent">' + esc(dep) + '</div></div>' +
      '<div class="info-cell"><div class="info-label">Destino</div><div class="info-value accent">' + esc(arr) + '</div></div>' +
      '<div class="info-cell"><div class="info-label">ICAO origen</div><div class="info-value">' + esc(depIcao) + '</div></div>' +
      '<div class="info-cell"><div class="info-label">ICAO destino</div><div class="info-value">' + esc(arrIcao) + '</div></div>' +
      '<div class="info-cell"><div class="info-label">Hora salida</div><div class="info-value">' + depTime + '</div></div>' +
      '<div class="info-cell"><div class="info-label">Hora llegada</div><div class="info-value">' + arrTime + '</div></div>' +
      '<div class="info-cell"><div class="info-label">ICAO24</div><div class="info-value">' + esc(f.icao24 || '—') + '</div></div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<div class="modal-action primary" onclick="App.openFlightradar(\'' + esc(cs) + '\')">' +
        '<span class="modal-action-icon">\uD83C\uDF10</span>Flightradar' +
      '</div>' +
      '<div class="modal-action" onclick="App.shareFlightInfo(\'' + esc(cs) + '\',\'\',\'\')">' +
        '<span class="modal-action-icon">\u2191</span>Compartir' +
      '</div>' +
    '</div>';

  $('modalOverlay').classList.add('open');
  $('modal').classList.add('open');
}

/* ── Cerrar modal ────────────────────────────────────────────── */
function closeModal() {
  $('modalOverlay').classList.remove('open');
  $('modal').classList.remove('open');
}

/* ── Acciones ────────────────────────────────────────────────── */
function copyCoords(lat, lon) {
  var txt = (parseFloat(lat)||0).toFixed(5) + ', ' + (parseFloat(lon)||0).toFixed(5);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(txt).then(function() { toast('\uD83D\uDCCD Coordenadas copiadas'); });
  } else {
    toast(txt);
  }
}

function openFlightradar(callsign) {
  if (callsign && callsign !== '—') {
    window.open('https://www.flightradar24.com/' + callsign, '_blank');
  }
}

function shareFlightInfo(callsign, lat, lon) {
  var text = '\u2708 Vuelo ' + callsign + ' en tiempo real' + (lat ? ' \u00B7 ' + parseFloat(lat).toFixed(3) + ', ' + parseFloat(lon).toFixed(3) : '');
  if (navigator.share) {
    navigator.share({ title: 'AeroTrack \u00B7 ' + callsign, text: text });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() { toast('Copiado al portapapeles'); });
  }
}

/* ── Cambio de tab ───────────────────────────────────────────── */
function switchTab(el, tab) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  if (el) el.classList.add('active');
  State.activeTab = tab;
  loadFlights();
}

/* ── Navegación inferior ─────────────────────────────────────── */
function navTo(section, el) {
  document.querySelectorAll('.nav-item').forEach(function(i) { i.classList.remove('active'); });
  if (el) el.classList.add('active');
  if (section === 'settings') showSettings();
  if (section === 'map') toast('\uD83D\UDDFB Mapa próximamente');
}

function focusSearch() {
  var inp = $('searchInput');
  if (inp) { inp.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
}

function showSettings() {
  var mode = State.serverMode === 'authenticated' ? 'Autenticado (4000 req/día)' : 'Anónimo (400 req/día)';
  alert(
    'AeroTrack — Configuración\n\n' +
    'Servidor: ' + window.location.host + '\n' +
    'OpenSky: ' + mode + '\n\n' +
    'Para credenciales edita .env y reinicia el servidor.\n' +
    'opensky-network.org/my-opensky/account'
  );
}

function refresh() {
  toast('\u21BA Actualizando\u2026');
  checkHealth();
  if (State.selectedAirport || State.activeTab === 'live') loadFlights();
}

/* ── API pública (window.App para onclick inline) ────────────── */
window.App = {
  search:          search,
  selectAirport:   selectAirport,
  switchTab:       switchTab,
  loadFlights:     loadFlights,
  openFlightModal: openFlightModal,
  openDepArrModal: openDepArrModal,
  closeModal:      closeModal,
  copyCoords:      copyCoords,
  openFlightradar: openFlightradar,
  shareFlightInfo: shareFlightInfo,
  navTo:           navTo,
  focusSearch:     focusSearch,
  refresh:         refresh,
};

/* ── Inicialización ──────────────────────────────────────────── */
(function init() {
  renderAirports();

  // Health check y contador global (sin bloquear UI)
  checkHealth();
  fetchGlobalCount();

  // Tecla Enter en el buscador
  var inp = $('searchInput');
  if (inp) {
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') search();
    });
  }

  // Auto-seleccionar Madrid al cargar
  var madridChip = document.querySelector('.airport-chip[data-icao="LEMD"]');
  if (madridChip) selectAirport('MAD', 'LEMD', madridChip);
})();
