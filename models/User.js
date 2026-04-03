/**
 * USER MODEL (LEGACY) - Archive User Support
 * Used for maintaining old login credentials during migration.
 */
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  }
}, {
  timestamps: true,
  collection: 'usernames'
});

module.exports = mongoose.model('User', userSchema);
