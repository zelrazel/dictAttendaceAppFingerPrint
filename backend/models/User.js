const mongoose = require('mongoose');

const biometricSchema = new mongoose.Schema({
  biometricId: { type: String, required: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  middleName: { type: String },
  lastName: { type: String, required: true },
  designation: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  password: { type: String, required: true },
  profileImage: { type: String, default: '' },
  biometrics: [biometricSchema],
  biometricsEnabled: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);