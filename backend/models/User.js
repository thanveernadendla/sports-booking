const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  phone: { type: String, required: true },
  username: { type: String },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  status: { type: String, enum: ['Approved', 'Pending', 'Rejected', 'Blocked'], default: 'Approved' }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
