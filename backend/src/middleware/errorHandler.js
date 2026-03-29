const errorHandler = (err, req, res, _next) => {
  console.error('Error:', err.message);

  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'A record with this value already exists',
      field: err.meta?.target,
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  if (err.message?.includes('Invalid file type')) {
    return res.status(400).json({ error: err.message });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
};

module.exports = errorHandler;
