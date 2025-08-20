const mongoose = require('mongoose');

const timeRecordSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  timeIn: {
    type: Date,
    required: true
  },
  timeOut: {
    type: Date
  },
  // AM session time tracking
  amTimeIn: {
    type: Date
  },
  amTimeOut: {
    type: Date
  },
  // PM session time tracking
  pmTimeIn: {
    type: Date
  },
  pmTimeOut: {
    type: Date
  },
  // Offset tracking for undertime and makeup
  undertime: {
    type: Number,
    default: 0
  },
  makeup: {
    type: Number,
    default: 0
  },
  makeupDate: {
    type: Date
  },

  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    },
    address: String,
    distance: Number // distance from office in meters
  },
  isWithinOfficeRange: {
    type: Boolean,
    default: false
  },
  totalHours: {
    type: Number,
    default: 0
  },
  // Biometric authentication tracking
  biometricAuthenticated: {
    type: Boolean,
    default: false
  },
  biometricId: {
    type: String
  },

}, { timestamps: true });


// Add index for geospatial queries
timeRecordSchema.index({ 'location.coordinates': '2dsphere' });

module.exports = mongoose.model('TimeRecord', timeRecordSchema);