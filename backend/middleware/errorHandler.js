function errorHandler(error, req, res, next) {
  console.error(error);
  res.status(500).json({ error: 'Server error. Please try again.' });
}

module.exports = errorHandler;
