const mongoose = require('mongoose');

const TournamentSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  sport: { type: String, required: true },
  startDate: { type: String, required: true },
  venue: { type: String, default: '' },
  status: { type: String, default: 'Open' }
}, { timestamps: true });

module.exports = mongoose.models.Tournament || mongoose.model('Tournament', TournamentSchema);
