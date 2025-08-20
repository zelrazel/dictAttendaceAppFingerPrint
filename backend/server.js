const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const User = require('./models/User');
const TimeRecord = require('./models/TimeRecord');
const OfficeLocation = require('./models/OfficeLocation');
const Event = require('./models/Event');
const axios = require('axios');
const moment = require('moment-timezone');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();

// File filter function to check file type and size
const fileFilter = (req, file, cb) => {
  // Check file type - only allow images
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed'), false);
  }
  
  // File size check will be done after upload in the route handler
  // since multer memory storage doesn't provide file size before complete upload
  cb(null, true);
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB in bytes
  }
});

// Register
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, firstName, middleName, lastName, designation, phoneNumber, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already exists' });
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      firstName,
      middleName,
      lastName,
      designation,
      phoneNumber,
      password: hashed,
    });
    await user.save();
    res.json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', email, password);
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found for email:', email);
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    console.log('User found:', user.email);
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch);
    if (!isMatch) {
      console.log('Password does not match for email:', email);
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    console.log('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Auth middleware
const auth = (req, res, next) => {
  let token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'No token' });
  // If token starts with 'Bearer ', strip it
  if (token.startsWith('Bearer ')) {
    token = token.slice(7);
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get profile
app.get('/api/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users
app.get('/api/users', auth, async (req, res) => {
  try {
    const users = await User.find().select('-password -biometrics');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload profile image
app.post('/api/profile/image', auth, (req, res, next) => {
  upload.single('profile')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds 5MB limit' });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Additional check for file type
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }
    
    const fileStr = req.file.buffer.toString('base64');
    const uploadResponse = await cloudinary.uploader.upload(
      `data:${req.file.mimetype};base64,${fileStr}`,
      { folder: 'profile_pics' }
    );
    
    console.log('Image uploaded to Cloudinary:', uploadResponse.secure_url);
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { profileImage: uploadResponse.secure_url },
      { new: true }
    ).select('-password');
    
    res.json(user);
  } catch (err) {
    console.error('Error uploading image:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete profile image
app.delete('/api/profile/image', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (user.profileImage) {
      // Extract public_id from the Cloudinary URL
      const urlParts = user.profileImage.split('/');
      const filename = urlParts[urlParts.length - 1];
      const publicId = `profile_pics/${filename.split('.')[0]}`;
      
      // Delete the image from Cloudinary
      try {
        await cloudinary.uploader.destroy(publicId);
        console.log('Image deleted from Cloudinary:', publicId);
      } catch (cloudinaryErr) {
        console.error('Error deleting from Cloudinary:', cloudinaryErr);
        // Continue even if Cloudinary delete fails
      }
    }
    
    // Update user record to remove profile image
    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { $unset: { profileImage: 1 } },
      { new: true }
    ).select('-password');
    
    res.json(updatedUser);
  } catch (err) {
    console.error('Error deleting profile image:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update profile information
app.put('/api/profile', auth, async (req, res) => {
  try {
    const { firstName, middleName, lastName, designation, phoneNumber } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !designation || !phoneNumber) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    
    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { firstName, middleName, lastName, designation, phoneNumber },
      { new: true }
    ).select('-password');
    
    console.log('Profile updated:', updatedUser);
    res.json(updatedUser);
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: err.message });
  }
});

// Biometric authentication endpoints

// Get all biometrics for the authenticated user
app.get('/api/biometrics', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      biometrics: user.biometrics || [],
      biometricsEnabled: user.biometricsEnabled || false
    });
  } catch (err) {
    console.error('Error fetching biometrics:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add a new biometric
app.post('/api/biometrics', auth, async (req, res) => {
  try {
    const { biometricId, name } = req.body;
    
    if (!biometricId || !name) {
      return res.status(400).json({ error: 'Biometric ID and name are required' });
    }
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if biometric already exists
    if (user.biometrics && user.biometrics.some(b => b.biometricId === biometricId)) {
      return res.status(400).json({ error: 'Biometric ID already exists' });
    }
    
    // Add new biometric
    user.biometrics = user.biometrics || [];
    user.biometrics.push({
      biometricId,
      name,
      createdAt: new Date()
    });
    
    // Enable biometrics if this is the first one
    if (user.biometrics.length === 1) {
      user.biometricsEnabled = true;
    }
    
    await user.save();
    
    res.json({
      message: 'Biometric added successfully',
      biometrics: user.biometrics,
      biometricsEnabled: user.biometricsEnabled
    });
  } catch (err) {
    console.error('Error adding biometric:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a biometric
app.delete('/api/biometrics/:id', auth, async (req, res) => {
  try {
    const biometricId = req.params.id;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if biometric exists
    if (!user.biometrics || !user.biometrics.some(b => b.biometricId === biometricId)) {
      return res.status(404).json({ error: 'Biometric not found' });
    }
    
    // Remove biometric
    user.biometrics = user.biometrics.filter(b => b.biometricId !== biometricId);
    
    // Disable biometrics if no biometrics left
    if (user.biometrics.length === 0) {
      user.biometricsEnabled = false;
    }
    
    await user.save();
    
    res.json({
      message: 'Biometric removed successfully',
      biometrics: user.biometrics,
      biometricsEnabled: user.biometricsEnabled
    });
  } catch (err) {
    console.error('Error removing biometric:', err);
    res.status(500).json({ error: err.message });
  }
});

// Toggle biometrics enabled status
app.put('/api/biometrics/toggle', auth, async (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Enabled status must be a boolean' });
    }
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove check for biometrics array
    user.biometricsEnabled = enabled;
    await user.save();
    
    res.json({
      message: `Biometric authentication ${enabled ? 'enabled' : 'disabled'} successfully`,
      biometricsEnabled: user.biometricsEnabled
    });
  } catch (err) {
    console.error('Error toggling biometrics:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create default office location if none exists
async function createDefaultOfficeLocation() {
  try {
    const count = await OfficeLocation.countDocuments();
    if (count === 0) {
      // Create a default office location with the specified coordinates
      const defaultOffice = new OfficeLocation({
        name: 'Main Office',
        location: {
          type: 'Point',
          coordinates: [120.59097690306716, 18.20585558594641] 
        },
        radius: 30, // 30 meters radius 
        address: 'Main Office Address',
        isActive: true
      });
      await defaultOffice.save();
      console.log('Default office location created with specified coordinates');
    }
  } catch (err) {
    console.error('Error creating default office location:', err);
  }
}

// Time record endpoints

// Get all time records for the authenticated user
app.get('/api/time-records', auth, async (req, res) => {
  try {
    const timeRecords = await TimeRecord.find({ user: req.userId })
      .sort({ date: -1, timeIn: -1 })
      .limit(30); // Limit to last 30 records
    res.json(timeRecords);
  } catch (err) {
    console.error('Error fetching time records:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get time records for a specific date
app.get('/api/time-records/date/:date', auth, async (req, res) => {
  try {
    const dateStr = req.params.date; // Format: YYYY-MM-DD
    const timezone = req.query.timezone || 'Asia/Manila';
    const startDate = moment.tz(dateStr, timezone).startOf('day').toDate();
    const endDate = moment.tz(dateStr, timezone).endOf('day').toDate();
    
    const timeRecords = await TimeRecord.find({
      user: req.userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ timeIn: 1 });
    
    res.json(timeRecords);
  } catch (err) {
    console.error('Error fetching time records for date:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get time records for a specific user with date range
app.get('/api/time-records/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, timezone } = req.query;
    const userTimezone = timezone || 'Asia/Manila';
    
    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Create query object
    const query = { user: userId };
    
    // Add date range if provided
    if (startDate && endDate) {
      const start = moment.tz(startDate, userTimezone).startOf('day').toDate();
      const end = moment.tz(endDate, userTimezone).endOf('day').toDate();
      
      query.date = { $gte: start, $lte: end };
    }
    
    const timeRecords = await TimeRecord.find(query).sort({ date: -1, timeIn: -1 });
    
    // Calculate total hours for each record if not already calculated
    const processedRecords = timeRecords.map(record => {
      const recordObj = record.toObject();
      
      // If totalHours is not already calculated
      if (recordObj.totalHours === undefined) {
        let totalHours = 0;
        
        // Calculate AM hours if available
        if (recordObj.amTimeIn && recordObj.amTimeOut) {
          const amTimeIn = new Date(recordObj.amTimeIn);
          const amTimeOut = new Date(recordObj.amTimeOut);
          totalHours += (amTimeOut - amTimeIn) / (1000 * 60 * 60);
        }
        
        // Calculate PM hours if available
        if (recordObj.pmTimeIn && recordObj.pmTimeOut) {
          const pmTimeIn = new Date(recordObj.pmTimeIn);
          const pmTimeOut = new Date(recordObj.pmTimeOut);
          totalHours += (pmTimeOut - pmTimeIn) / (1000 * 60 * 60);
        }
        
        // If neither AM nor PM has complete records, but timeIn and timeOut exist
        if ((!recordObj.amTimeIn || !recordObj.amTimeOut) && 
            (!recordObj.pmTimeIn || !recordObj.pmTimeOut) && 
            recordObj.timeIn && recordObj.timeOut) {
          const timeIn = new Date(recordObj.timeIn);
          const timeOut = new Date(recordObj.timeOut);
          totalHours = (timeOut - timeIn) / (1000 * 60 * 60);
        }
        
        recordObj.totalHours = parseFloat(totalHours.toFixed(2));
      }
      
      return recordObj;
    });
    
    res.json(processedRecords);
  } catch (err) {
    console.error('Error fetching time records for user with date range:', err);
    res.status(500).json({ error: err.message });
  }
});

// Time in
app.post('/api/time-records/time-in', auth, async (req, res) => {
  try {
    const { coordinates, session, biometricAuthenticated, timezone } = req.body;
    const userTimezone = timezone || 'Asia/Manila';
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({ error: 'Valid coordinates are required' });
    }
    
    if (!session || !['AM', 'PM'].includes(session)) {
      return res.status(400).json({ error: 'Valid session (AM or PM) is required' });
    }
    
    // Check if biometric authentication is enabled for this user
    const user = await User.findById(req.userId);
    if (user.biometricsEnabled && !biometricAuthenticated) {
      return res.status(400).json({ error: 'Biometric authentication is required' });
    }
    
    // Calculate start and end of today in user's timezone
    const todayStart = moment.tz(userTimezone).startOf('day').toDate();
    const todayEnd = moment.tz(userTimezone).endOf('day').toDate();
    
    let existingRecord = await TimeRecord.findOne({
      user: req.userId,
      date: { $gte: todayStart, $lte: todayEnd }
    });
    
    // Get the active office location
    const officeLocation = await OfficeLocation.findOne({ isActive: true });
    if (!officeLocation) {
      return res.status(404).json({ error: 'No active office location found' });
    }
    
    // Get user's current location
    const [longitude, latitude] = coordinates;
    
    // Calculate distance using Haversine formula
    const [officeLong, officeLat] = officeLocation.location.coordinates;
    
    const R = 6371e3; // Earth radius in meters
    const φ1 = latitude * Math.PI/180;
    const φ2 = officeLat * Math.PI/180;
    const Δφ = (officeLat-latitude) * Math.PI/180;
    const Δλ = (officeLong-longitude) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = Math.round(R * c); // Distance in meters
    
    // Check if user is within the office radius
    const isWithinOfficeRange = distance <= officeLocation.radius;
    
    console.log(`Distance from office: ${distance}m, Within range: ${isWithinOfficeRange}`);
    
    // If not within range, return error
    if (!isWithinOfficeRange) {
      return res.status(400).json({ 
        error: `You must be within office range to time in. You are currently ${distance} meters away from the office.` 
      });
    }
    
    const currentTime = new Date();
    
    if (existingRecord) {
      // Update existing record with session-specific time in
      if (session === 'AM') {
        if (existingRecord.amTimeIn) {
          return res.status(400).json({ error: 'You already have an AM time-in record for today' });
        }
        existingRecord.amTimeIn = currentTime;
        existingRecord.timeIn = currentTime; // For backward compatibility
      } else { // PM session
        if (existingRecord.pmTimeIn) {
          return res.status(400).json({ error: 'You already have a PM time-in record for today' });
        }
        existingRecord.pmTimeIn = currentTime;
        if (!existingRecord.timeIn) {
          existingRecord.timeIn = currentTime; // For backward compatibility
        }
      }
      
      existingRecord.session = session; // Update current session
      existingRecord.location.coordinates = [longitude, latitude];
      existingRecord.location.distance = distance;
      existingRecord.isWithinOfficeRange = isWithinOfficeRange;
      existingRecord.biometricAuthenticated = !!biometricAuthenticated;
      
      await existingRecord.save();
      
      res.json({
        timeRecord: existingRecord,
        message: `${session} Time-in successful. You are within office range (${distance} meters from office).`
      });
    } else {
      // Create new time record
      const timeRecord = new TimeRecord({
        user: req.userId,
        date: todayStart,
        timeIn: currentTime, // For backward compatibility
        location: {
          type: 'Point',
          coordinates: [longitude, latitude],
          distance: distance
        },
        isWithinOfficeRange,
        session,
        biometricAuthenticated: !!biometricAuthenticated
      });
      
      // Set session-specific time in
      if (session === 'AM') {
        timeRecord.amTimeIn = currentTime;
      } else { // PM session
        timeRecord.pmTimeIn = currentTime;
      }
      
      await timeRecord.save();
      res.json({
        timeRecord,
        message: `${session} Time-in successful. You are within office range (${distance} meters from office).`
      });
    }
  } catch (err) {
    console.error('Error during time-in:', err);
    res.status(500).json({ error: err.message });
  }
});

// Time out
app.post('/api/time-records/:id/time-out', auth, async (req, res) => {
  try {
    const { coordinates, session, biometricAuthenticated, timezone } = req.body;
    const userTimezone = timezone || 'Asia/Manila';
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({ error: 'Valid coordinates are required' });
    }
    
    if (!session || !['AM', 'PM'].includes(session)) {
      return res.status(400).json({ error: 'Valid session (AM or PM) is required' });
    }
    
    // Check if biometric authentication is enabled for this user
    const user = await User.findById(req.userId);
    if (user.biometricsEnabled && !biometricAuthenticated) {
      return res.status(400).json({ error: 'Biometric authentication is required' });
    }
    
    // Find the time record
    const timeRecord = await TimeRecord.findOne({
      _id: req.params.id,
      user: req.userId
    });
    
    if (!timeRecord) {
      return res.status(404).json({ error: 'Time record not found' });
    }
    
    // Check if already timed out for this session
    if ((session === 'AM' && timeRecord.amTimeOut) || (session === 'PM' && timeRecord.pmTimeOut)) {
      return res.status(400).json({ error: `You have already timed out for the ${session} session` });
    }
    
    // Get the active office location
    const officeLocation = await OfficeLocation.findOne({ isActive: true });
    if (!officeLocation) {
      return res.status(404).json({ error: 'No active office location found' });
    }
    
    // Get user's current location
    const [longitude, latitude] = coordinates;
    
    // Calculate distance from office using Haversine formula
    const [officeLong, officeLat] = officeLocation.location.coordinates;
    
    const R = 6371e3; // Earth radius in meters
    const φ1 = latitude * Math.PI/180;
    const φ2 = officeLat * Math.PI/180;
    const Δφ = (officeLat-latitude) * Math.PI/180;
    const Δλ = (officeLong-longitude) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = Math.round(R * c); // Distance in meters
    
    // Check if user is within the office radius
    const isWithinOfficeRange = distance <= officeLocation.radius;
    
    console.log(`Distance from office: ${distance}m, Within range: ${isWithinOfficeRange}`);
    
    // If not within range, return error
    if (!isWithinOfficeRange) {
      return res.status(400).json({ 
        error: `You must be within office range to time out. You are currently ${distance} meters away from the office.` 
      });
    }
    
    // Update time record with time out
    const timeOut = new Date();
    let totalHours = 0;
    
    if (session === 'AM') {
      if (!timeRecord.amTimeIn) {
        return res.status(400).json({ error: 'You need to time in for AM session first' });
      }
      
      const amTimeIn = new Date(timeRecord.amTimeIn);
      const amHours = (timeOut - amTimeIn) / (1000 * 60 * 60); // Convert ms to hours
      
      timeRecord.amTimeOut = timeOut;
      totalHours = parseFloat(amHours.toFixed(2));
      
      // For backward compatibility
      if (!timeRecord.timeOut) {
        timeRecord.timeOut = timeOut;
      }
    } else { // PM session
      if (!timeRecord.pmTimeIn) {
        return res.status(400).json({ error: 'You need to time in for PM session first' });
      }
      
      const pmTimeIn = new Date(timeRecord.pmTimeIn);
      const pmHours = (timeOut - pmTimeIn) / (1000 * 60 * 60); // Convert ms to hours
      
      timeRecord.pmTimeOut = timeOut;
      totalHours = parseFloat(pmHours.toFixed(2));
      
      // For backward compatibility
      timeRecord.timeOut = timeOut;
    }
    
    // Calculate total hours for the day
    let dayTotalHours = 0;
    
    // Add AM hours if available
    if (timeRecord.amTimeIn && timeRecord.amTimeOut) {
      const amTimeIn = new Date(timeRecord.amTimeIn);
      const amTimeOut = new Date(timeRecord.amTimeOut);
      dayTotalHours += (amTimeOut - amTimeIn) / (1000 * 60 * 60);
    }
    
    // Add PM hours if available
    if (timeRecord.pmTimeIn && timeRecord.pmTimeOut) {
      const pmTimeIn = new Date(timeRecord.pmTimeIn);
      const pmTimeOut = new Date(timeRecord.pmTimeOut);
      dayTotalHours += (pmTimeOut - pmTimeIn) / (1000 * 60 * 60);
    }
    
    // Check if either AM or PM session has complete time records
    const hasCompleteAMSession = timeRecord.amTimeIn && timeRecord.amTimeOut;
    const hasCompletePMSession = timeRecord.pmTimeIn && timeRecord.pmTimeOut;
    
    // If this is the final time-out for the day (both AM and PM sessions are present)
    // and neither session is complete, throw an error
    if (timeRecord.amTimeIn && timeRecord.pmTimeIn && !hasCompleteAMSession && !hasCompletePMSession) {
      return res.status(400).json({ 
        error: 'You must complete either AM or PM session with both time-in and time-out' 
      });
    }
    
    timeRecord.totalHours = parseFloat(dayTotalHours.toFixed(2));
    timeRecord.isWithinOfficeRange = true; // Always within range
    
    // Update the distance in the location field
    timeRecord.location.distance = distance;
    timeRecord.biometricAuthenticated = !!biometricAuthenticated;
    await timeRecord.save();
    
    res.json({
      timeRecord,
      message: `${session} Time-out successful. You are within office range (${distance} meters from office).`
    });
  } catch (err) {
    console.error('Error during time-out:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get office location
app.get('/api/office-location', auth, async (req, res) => {
  try {
    // Get the actual stored office location
    const officeLocation = await OfficeLocation.findOne({ isActive: true });
    if (!officeLocation) {
      return res.status(404).json({ error: 'No active office location found' });
    }
    
    console.log('Returning actual office location');
    res.json(officeLocation);
  } catch (err) {
    console.error('Error fetching office location:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add offset (undertime/makeup) to time record
app.post('/api/time-records/:id/offset', auth, async (req, res) => {
  try {
    const { undertime, makeup, makeupDate } = req.body;
    
    // Find the time record
    const timeRecord = await TimeRecord.findOne({
      _id: req.params.id,
      user: req.userId
    });
    
    if (!timeRecord) {
      return res.status(404).json({ error: 'Time record not found' });
    }
    
    // Update the time record with offset information
    if (undertime !== undefined) {
      timeRecord.undertime = parseFloat(undertime);
    }
    
    if (makeup !== undefined) {
      timeRecord.makeup = parseFloat(makeup);
    }
    
    if (makeupDate) {
      timeRecord.makeupDate = new Date(makeupDate);
    }
    
    await timeRecord.save();
    
    res.json({
      timeRecord,
      message: 'Offset information updated successfully'
    });
  } catch (err) {
    console.error('Error updating offset information:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update office location (admin only - would need admin middleware in production)
app.put('/api/office-location/:id', auth, async (req, res) => {
  try {
    const { name, coordinates, radius, address, isActive } = req.body;
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({ error: 'Valid coordinates are required' });
    }
    
    const updatedLocation = await OfficeLocation.findByIdAndUpdate(
      req.params.id,
      {
        name,
        'location.coordinates': coordinates,
        radius,
        address,
        isActive
      },
      { new: true }
    );
    
    if (!updatedLocation) {
      return res.status(404).json({ error: 'Office location not found' });
    }
    
    res.json(updatedLocation);
  } catch (err) {
    console.error('Error updating office location:', err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch PH holidays from Nager.Date
app.get('/api/holidays/:year', auth, async (req, res) => {
  try {
    const { year } = req.params;
    const response = await axios.get(`https://date.nager.at/api/v3/PublicHolidays/${year}/PH`);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

// Get events for a specific date (YYYY-MM-DD)
app.get('/api/events/:date', auth, async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.userId;
    // Find events for the user on the given date
    const start = new Date(date);
    start.setHours(0,0,0,0);
    const end = new Date(date);
    end.setHours(23,59,59,999);
    const events = await Event.find({ userId, date: { $gte: start, $lte: end } });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get all events for the authenticated user
app.get('/api/events', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const events = await Event.find({ userId }).sort({ date: -1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch all events' });
  }
});

// Add a new event
app.post('/api/events', auth, async (req, res) => {
  try {
    const { title, date, endDate, startTime, endTime, location, description } = req.body;
    const userId = req.userId;
    const event = new Event({ title, date, endDate, startTime, endTime, location, description, userId });
    await event.save();
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Delete an event
app.delete('/api/events/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const event = await Event.findOneAndDelete({ _id: id, userId });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  createDefaultOfficeLocation();
});
