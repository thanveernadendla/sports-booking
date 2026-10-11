try {
  require('dns').setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const mongoose = require('mongoose');
const { MONGODB_URI, DEFAULT_DB } = require('./constants');
const User = require('../models/User');
const Venue = require('../models/Venue');

async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error('[MongoDB Atlas] MONGODB_URI is missing in configuration.');
  }

  try {
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000
    });
    console.log('[MongoDB Atlas] Successfully connected to cluster database:', mongoose.connection.name);

    // Seed default admin user if no admin exists
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      await User.create(DEFAULT_DB.users[0]);
      console.log('[MongoDB Atlas] Seeded default admin user.');
    }

    // Seed default venues if venues collection is empty
    const venueCount = await Venue.countDocuments();
    if (venueCount === 0) {
      await Venue.insertMany(DEFAULT_DB.venues);
      console.log('[MongoDB Atlas] Seeded default venues.');
    }

    return mongoose.connection;
  } catch (error) {
    console.error('[MongoDB Atlas Connection Error]', error.message);
    throw error;
  }
}

module.exports = { connectDB };

