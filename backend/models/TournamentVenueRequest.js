const mongoose = require('mongoose');

const TournamentVenueRequestSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  tournamentName: { type: String, required: true },
  venue: { type: String, required: true },
  requestedDate: { type: String, required: true },
  notes: { type: String, default: '' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  userId: { type: Number, required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.models.TournamentVenueRequest || mongoose.model('TournamentVenueRequest', TournamentVenueRequestSchema);
