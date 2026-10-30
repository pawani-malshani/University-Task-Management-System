function notFoundHandler(req, res, next) {
  res.status(404).json({
    status: 404,
    error: 'Not Found',
    message: `Resource at ${req.originalUrl} was not found.`,
    timestamp: new Date().toISOString()
  });
}

function globalErrorHandler(err, req, res, next) {
  console.error('API Error:', err);

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    status: statusCode,
    error: statusCode === 404 ? 'Not Found' : statusCode === 400 ? 'Bad Request' : 'Internal Server Error',
    message: message,
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  notFoundHandler,
  globalErrorHandler
};
