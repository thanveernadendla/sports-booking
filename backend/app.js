const express = require('express');
const cors = require('cors');
const path = require('path');

const pageRoutes = require('./routes/pageRoutes');
const statsRoutes = require('./routes/statsRoutes');
const authRoutes = require('./routes/authRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const errorHandler = require('./middleware/errorHandler');

const { connectDB } = require('./config/db');

const app = express();

// Ensure DB is connected before processing requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use(express.static(path.join(__dirname, '..', 'frontend', 'pages')));
app.use(express.static(path.join(__dirname, '..', 'deployment')));

app.get('/download/apk', (req, res) => {
  res.download(path.join(__dirname, '..', 'deployment', 'SportZone.apk'));
});



// Mount routes
app.use('/', pageRoutes);
app.use('/api', statsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', bookingRoutes);
app.use('/api/admin', adminRoutes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
