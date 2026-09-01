const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose'); // Swapped sqlite3 for mongoose
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

const app = express();
let PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const ADMIN_USERNAME = 'OfficialCCY';
const ADMIN_PASSWORD = 'thesuperopslime';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// DATABASE SETUP (MONGODB ATLAS)
// ============================================
const dbURI = process.env.DATABASE_URL || 'mongodb+srv://haikuhaiku092205_db_user:XnJRvTNFmtFh8EeE@cluster0.xwfjbys.mongodb.net/comicary?appName=Cluster0';

async function connectToDatabase() {
  await mongoose.connect(dbURI, {
    serverSelectionTimeoutMS: 10000,
    family: 4
  });
  console.log('Successfully connected to MongoDB Atlas!');
}

// --- Schemas & Models ---

// Users Schema
const userSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 }, // Kept text string UUIDs for frontend consistency
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: { type: String },
  profilePicture: { type: String },
  aboutMe: { type: String },
  createdAt: { type: Date, default: Date.now },
  isVerified: { type: Boolean, default: true },
  isAdmin: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);

// Uploads Schema
const uploadSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  title: { type: String, required: true },
  image: { type: String, required: true },
  uploadedBy: { type: String, ref: 'User', required: true },
  author: { type: String, default: '' },
  synopsis: { type: String, default: '' },
  genre: { type: String, default: '' },
  status: { type: String, default: 'published' },
  uploadedAt: { type: Date, default: Date.now }
});
const Upload = mongoose.model('Upload', uploadSchema);

// Ratings Schema
const ratingSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  uploadId: { type: String, ref: 'Upload', required: true },
  userId: { type: String, ref: 'User', required: true },
  rating: { type: Number, required: true }
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

// Ensure unique compound index for ratings (one rating per user per comic)
ratingSchema.index({ uploadId: 1, userId: 1 }, { unique: true });
const Rating = mongoose.model('Rating', ratingSchema);

// Auto-create admin account if it doesn't exist
async function ensureAdminExists() {
  try {
    const admin = await User.findOne({ username: ADMIN_USERNAME });
    if (admin) {
      console.log('✅ Admin account already exists');
      return;
    }
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await User.create({
      _id: uuidv4(),
      username: ADMIN_USERNAME,
      password: hashedPassword,
      name: 'Admin',
      isVerified: true,
      isAdmin: true
    });
    console.log(`✅ Admin account created: ${ADMIN_USERNAME}`);
  } catch (error) {
    console.error('Error checking/creating admin account:', error);
  }
}

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Sign Up
app.post('/api/auth/signup', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const isAdmin = username === ADMIN_USERNAME && password === ADMIN_PASSWORD;

    const newUser = await User.create({
      _id: userId,
      username,
      password: hashedPassword,
      name: username,
      isVerified: true,
      isAdmin: isAdmin
    });

    const token = jwt.sign({ id: newUser._id, username: newUser.username, isAdmin: newUser.isAdmin }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      success: true,
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        name: newUser.username,
        isAdmin: newUser.isAdmin
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Admin Sign Up
app.post('/api/auth/admin-signup', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Invalid admin credentials. Only authorized credentials can create the admin account.' });
  }

  try {
    const existingAdmin = await User.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin account already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    const newAdmin = await User.create({
      _id: userId,
      username,
      password: hashedPassword,
      name: username,
      isVerified: true,
      isAdmin: true
    });

    const token = jwt.sign({ id: newAdmin._id, username: newAdmin.username, isAdmin: true }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      success: true,
      token,
      user: {
        id: newAdmin._id,
        username: newAdmin.username,
        name: newAdmin.username,
        isAdmin: true
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Sign In
app.post('/api/auth/signin', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user._id, username: user.username, isAdmin: user.isAdmin }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name || user.username,
        isAdmin: !!user.isAdmin
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// ============================================
// UPLOAD ROUTES
// ============================================

function isAdminUser(user) {
  return Boolean(user && (user.isAdmin === true || user.isAdmin === 1 || user.isAdmin === '1'));
}

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    req.user.isAdmin = isAdminUser(decoded);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Get all uploads with average ratings
app.get('/api/uploads', async (req, res) => {
  const status = req.query.status || 'published';
  const userId = req.query.userId;

  try {
    let filter = { status: status };
    if (userId) {
      filter.uploadedBy = userId;
    }

    const rows = await Upload.find(filter)
      .select('id title author synopsis genre uploadedBy uploadedAt status')
      .sort({ uploadedAt: -1 })
      .limit(50)
      .lean();

    const uploadsWithRatings = await Promise.all(
      rows.map(async (upload) => {
        const ratingStats = await Rating.aggregate([
          { $match: { uploadId: upload._id } },
          {
            $group: {
              _id: null,
              avgRating: { $avg: '$rating' },
              totalRatings: { $sum: 1 }
            }
          }
        ]);

        const hasStats = ratingStats.length > 0;
        return {
          id: upload._id,
          title: upload.title,
          author: upload.author,
          synopsis: upload.synopsis,
          genre: upload.genre,
          uploadedBy: upload.uploadedBy,
          uploadedAt: upload.uploadedAt,
          status: upload.status,
          avgRating: hasStats ? parseFloat(ratingStats[0].avgRating).toFixed(1) : "0.0",
          totalRatings: hasStats ? ratingStats[0].totalRatings : 0
        };
      })
    );

    res.json(uploadsWithRatings);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching uploads' });
  }
});

// Get upload image
app.get('/api/uploads/:id/image', async (req, res) => {
  try {
    const row = await Upload.findById(req.params.id).select('image');
    if (!row || !row.image) {
      return res.status(404).json({ error: 'Upload not found' });
    }
    res.setHeader('Content-Type', 'image/png');
    res.send(Buffer.from(row.image.split(',')[1], 'base64'));
  } catch (error) {
    res.status(500).json({ error: 'Error pulling image file source raw binary content data stream' });
  }
});

// Create upload
app.post('/api/uploads', verifyToken, async (req, res) => {
  const { title, image, author, synopsis, genre } = req.body;
  if (!title || !image) {
    return res.status(400).json({ error: 'Title and image required' });
  }
  try {
    const newUpload = await Upload.create({
      _id: uuidv4(),
      title,
      image,
      uploadedBy: req.user.id,
      author: author || '',
      synopsis: synopsis || '',
      genre: genre || '',
      status: 'pending'
    });
    res.json({ success: true, id: newUpload._id });
  } catch (error) {
    res.status(500).json({ error: 'Error creating upload' });
  }
});

// Delete upload
app.delete('/api/uploads/:id', verifyToken, async (req, res) => {
  const uploadId = req.params.id;
  try {
    const upload = await Upload.findById(uploadId).select('uploadedBy status');
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }
    const isAdmin = isAdminUser(req.user);
    const isOwnerOfPending = upload.uploadedBy === req.user.id && upload.status === 'pending';
    if (!isAdmin && !isOwnerOfPending) {
      return res.status(403).json({ error: 'You can only delete your own pending submissions' });
    }
    await Rating.deleteMany({ uploadId: uploadId });
    await Upload.findByIdAndDelete(uploadId);
    res.json({ success: true, message: 'Upload deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting upload elements' });
  }
});

// Edit pending upload
app.put('/api/uploads/:id', verifyToken, async (req, res) => {
  const uploadId = req.params.id;
  const { title, image, author, synopsis, genre } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  try {
    const upload = await Upload.findById(uploadId);
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }
    if (upload.uploadedBy !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own uploads' });
    }
    if (upload.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending uploads can be edited' });
    }
    upload.title = title;
    upload.author = author || '';
    upload.synopsis = synopsis || '';
    upload.genre = genre || '';
    if (image) upload.image = image;
    await upload.save();
    res.json({ success: true, id: uploadId });
  } catch (error) {
    res.status(500).json({ error: 'Error updating upload' });
  }
});

// Publish pending upload
app.post('/api/uploads/:id/publish', verifyToken, async (req, res) => {
  const uploadId = req.params.id;
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Only admins can publish uploads' });
  }
  try {
    const upload = await Upload.findById(uploadId);
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }
    if (upload.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending uploads can be published' });
    }
    upload.status = 'published';
    await upload.save();
    res.json({
      success: true,
      upload: {
        id: upload._id,
        title: upload.title,
        author: upload.author,
        synopsis: upload.synopsis,
        genre: upload.genre,
        uploadedBy: upload.uploadedBy,
        uploadedAt: upload.uploadedAt,
        status: upload.status
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error publishing upload' });
  }
});

// Reject pending upload
app.post('/api/uploads/:id/reject', verifyToken, async (req, res) => {
  const uploadId = req.params.id;
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Only admins can reject uploads' });
  }
  try {
    const upload = await Upload.findById(uploadId);
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }
    if (upload.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending uploads can be rejected' });
    }
    await Rating.deleteMany({ uploadId: uploadId });
    await Upload.findByIdAndDelete(uploadId);
    res.json({ success: true, message: 'Upload rejected and removed' });
  } catch (error) {
    res.status(500).json({ error: 'Error rejecting upload' });
  }
});

// Post a rating
app.post('/api/ratings', verifyToken, async (req, res) => {
  const { uploadId, rating } = req.body;
  if (!uploadId || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Valid uploadId and rating (1-5) required' });
  }
  try {
    await Rating.findOneAndUpdate(
      { uploadId, userId: req.user.id },
      { rating },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const stats = await Rating.aggregate([
      { $match: { uploadId: uploadId } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 }
        }
      }
    ]);
    res.json({
      success: true,
      avgRating: stats.length > 0 ? parseFloat(stats[0].avgRating).toFixed(1) : "0.0",
      totalRatings: stats.length > 0 ? stats[0].totalRatings : 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Error saving rating metric points data' });
  }
});

// Get rating for current user
app.get('/api/ratings/:uploadId', verifyToken, async (req, res) => {
  try {
    const row = await Rating.findOne({ uploadId: req.params.uploadId, userId: req.user.id }).select('rating');
    res.json({ rating: row ? row.rating : 0 });
  } catch (error) {
    res.json({ rating: 0 });
  }
});

// ============================================
// PROFILE ROUTES
// ============================================

// Get user profile
app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user._id,
      username: user.username,
      name: user.name,
      profilePicture: user.profilePicture,
      aboutMe: user.aboutMe,
      createdAt: user.createdAt,
      isAdmin: user.isAdmin
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching profile dataset' });
  }
});

// Update user profile
app.put('/api/profile', verifyToken, async (req, res) => {
  const { name, aboutMe, profilePicture } = req.body;
  let updateData = {};
  if (name !== undefined) updateData.name = name;
  if (aboutMe !== undefined) updateData.aboutMe = aboutMe;
  if (profilePicture !== undefined) updateData.profilePicture = profilePicture;
  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  try {
    const updatedUser = await User.findByIdAndUpdate(req.user.id, updateData, { new: true }).select('-password');
    res.json({
      success: true,
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        name: updatedUser.name,
        profilePicture: updatedUser.profilePicture,
        aboutMe: updatedUser.aboutMe,
        createdAt: updatedUser.createdAt,
        isAdmin: updatedUser.isAdmin
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error updating profile dataset' });
  }
});

// Get profile picture
app.get('/api/profile/:userId/picture', async (req, res) => {
  try {
    const row = await User.findById(req.params.userId).select('profilePicture');
    if (!row || !row.profilePicture) {
      return res.status(404).json({ error: 'Profile picture not found' });
    }
    res.setHeader('Content-Type', 'image/png');
    res.send(Buffer.from(row.profilePicture.split(',')[1], 'base64'));
  } catch (error) {
    res.status(500).json({ error: 'Error pulling profile media data stream payload' });
  }
});

// ============================================
// START SERVER
// ============================================
async function startServer() {
  try {
    await connectToDatabase();
    await ensureAdminExists();
  } catch (error) {
    console.error('MongoDB database connection error:', error.message);
    console.error('Check DATABASE_URL, MongoDB Atlas network access, and database credentials.');
    process.exitCode = 1;
    return;
  }

  app.listen(PORT, () => {
    console.log(`🚀 Comicary Mongoose server running on http://localhost:${PORT}`);
    console.log(`🔐 Admin Account: ${ADMIN_USERNAME}`);
  });
}
startServer();
