const mongoose = require('mongoose');

const VenueSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  fee: { type: Number, required: true },
  status: { type: String, enum: ['Approved', 'Pending', 'Rejected'], default: 'Approved' }
}, { timestamps: true });

module.exports = mongoose.models.Venue || mongoose.model('Venue', VenueSchema);
