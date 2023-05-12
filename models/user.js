const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: String,
  documentId: String,
  content: String,
});

const User = mongoose.model('User', UserSchema);

module.exports = User;

