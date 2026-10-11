const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  time: { type: String, required: true },
  venue: { type: String, required: true },
  team: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  date: { type: String, required: true },
  userId: { type: Number, required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  fee: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.models.Booking || mongoose.model('Booking', BookingSchema);
