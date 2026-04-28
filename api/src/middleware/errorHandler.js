const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err.code === '23505') { // Postgres unique violation
    return res.status(409).json({ error: 'Resource already exists.' });
  }
  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({ error: 'Referenced resource not found.' });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error.',
  });
};

const notFound = (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
};

module.exports = { errorHandler, notFound };
