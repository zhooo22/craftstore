// backend/middleware/errorHandler.js

/**
 * Central error handler — always returns JSON
 */
exports.errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} →`, err.message);

  // SQLite constraint errors
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'A record with that value already exists.' });
  }
  if (err.code?.startsWith('SQLITE_')) {
    return res.status(500).json({ error: 'Database error. Please try again.' });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * 404 handler for unmatched routes
 */
exports.notFound = (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
};
