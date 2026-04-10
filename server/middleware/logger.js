// ============================================================
//  AeroTrack — Logger Middleware
// ============================================================

function logRequest(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms     = Date.now() - start;
    const status = res.statusCode;
    const color  = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
    const reset  = '\x1b[0m';
    if (req.path.startsWith('/api/')) {
      console.log(`${color}[${status}]${reset} ${req.method} ${req.path} — ${ms}ms`);
    }
  });
  next();
}

module.exports = { logRequest };
