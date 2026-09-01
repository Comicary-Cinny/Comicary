const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
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
// DATABASE SETUP
// ============================================

const db = new sqlite3.Database('./comicary.db', (err) => {
  if (err) console.error('Database error:', err);
  else console.log('Connected to SQLite database');
});

// Create tables
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      profilePicture LONGTEXT,
      aboutMe TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      isVerified BOOLEAN DEFAULT 1,
      isAdmin BOOLEAN DEFAULT 0
    )
  `);

  // Verification codes table - no longer used, but keep for backward compatibility
  // db.run(`
  //   CREATE TABLE IF NOT EXISTS verification_codes (
  //     id TEXT PRIMARY KEY,
  //     email TEXT NOT NULL,
  //     code TEXT NOT NULL,
  //     expiresAt DATETIME NOT NULL,
  //     attempts INT DEFAULT 0,
  //     createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  //   )
  // `);

  // Uploads table
  db.run(`
    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      image LONGTEXT NOT NULL,
      uploadedBy TEXT NOT NULL,
      author TEXT,
      synopsis TEXT,
      genre TEXT,
      status TEXT DEFAULT 'published',
      uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploadedBy) REFERENCES users(id)
    )
  `);

  db.all('PRAGMA table_info(uploads)', (err, columns) => {
    if (err) return;
    const existingColumns = new Set((columns || []).map(column => column.name));
    const missingColumns = [];

    if (!existingColumns.has('author')) missingColumns.push('ALTER TABLE uploads ADD COLUMN author TEXT');
    if (!existingColumns.has('synopsis')) missingColumns.push('ALTER TABLE uploads ADD COLUMN synopsis TEXT');
    if (!existingColumns.has('genre')) missingColumns.push('ALTER TABLE uploads ADD COLUMN genre TEXT');
    if (!existingColumns.has('status')) missingColumns.push('ALTER TABLE uploads ADD COLUMN status TEXT DEFAULT "published"');

    missingColumns.forEach((sql) => {
      db.run(sql);
    });
  });

  db.all('PRAGMA table_info(users)', (err, columns) => {
    if (err) return;
    const existingColumns = new Set((columns || []).map(column => column.name));
    const missingColumns = [];

    if (!existingColumns.has('profilePicture')) missingColumns.push('ALTER TABLE users ADD COLUMN profilePicture LONGTEXT');
    if (!existingColumns.has('aboutMe')) missingColumns.push('ALTER TABLE users ADD COLUMN aboutMe TEXT');
    if (!existingColumns.has('isAdmin')) missingColumns.push('ALTER TABLE users ADD COLUMN isAdmin BOOLEAN DEFAULT 0');

    missingColumns.forEach((sql) => {
      db.run(sql);
    });
  });

  // Ratings table
  db.run(`
    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY,
      uploadId TEXT NOT NULL,
      userId TEXT NOT NULL,
      rating INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(uploadId, userId),
      FOREIGN KEY (uploadId) REFERENCES uploads(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);
});

// Auto-create admin account if it doesn't exist
async function ensureAdminExists() {
  return new Promise((resolve) => {
    db.get('SELECT id FROM users WHERE username = ?', [ADMIN_USERNAME], async (err, row) => {
      if (row) {
        console.log('✅ Admin account already exists');
        resolve();
        return;
      }

      try {
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
        const adminId = uuidv4();

        db.run(
          'INSERT INTO users (id, username, password, name, isVerified, isAdmin) VALUES (?, ?, ?, ?, 1, 1)',
          [adminId, ADMIN_USERNAME, hashedPassword, 'Admin'],
          (err) => {
            if (err) {
              console.error('Error creating admin account:', err);
            } else {
              console.log(`✅ Admin account created: ${ADMIN_USERNAME}`);
            }
            resolve();
          }
        );
      } catch (error) {
        console.error('Error hashing admin password:', error);
        resolve();
      }
    });
  });
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
    // Check if username exists
    db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
      if (row) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      
      // Check if this is the admin account
      const isAdmin = username === ADMIN_USERNAME && password === ADMIN_PASSWORD;

      // Insert user directly without verification
      db.run(
        'INSERT INTO users (id, username, password, name, isVerified, isAdmin) VALUES (?, ?, ?, ?, 1, ?)',
        [userId, username, hashedPassword, username, isAdmin ? 1 : 0],
        async (err) => {
          if (err) {
            return res.status(500).json({ error: 'Error creating user' });
          }

          // Generate JWT token immediately
          const token = jwt.sign({ id: userId, username: username, isAdmin: isAdmin }, JWT_SECRET, {
            expiresIn: '7d'
          });

          res.json({
            success: true,
            token,
            user: {
              id: userId,
              username: username,
              name: username,
              isAdmin: isAdmin
            }
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Admin Sign Up (dedicated endpoint for admin account creation)
app.post('/api/auth/admin-signup', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Only allow the specific admin credentials
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Invalid admin credentials. Only authorized credentials can create the admin account.' });
  }

  try {
    // Check if admin user already exists
    db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
      if (row) {
        return res.status(400).json({ error: 'Admin account already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();

      // Insert admin user
      db.run(
        'INSERT INTO users (id, username, password, name, isVerified, isAdmin) VALUES (?, ?, ?, ?, 1, 1)',
        [userId, username, hashedPassword, username],
        async (err) => {
          if (err) {
            return res.status(500).json({ error: 'Error creating admin account' });
          }

          // Generate JWT token immediately
          const token = jwt.sign({ id: userId, username: username, isAdmin: true }, JWT_SECRET, {
            expiresIn: '7d'
          });

          res.json({
            success: true,
            token,
            user: {
              id: userId,
              username: username,
              name: username,
              isAdmin: true
            }
          });
        }
      );
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
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (!user) {
        return res.status(400).json({ error: 'Invalid username or password' });
      }

      // Check password
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(400).json({ error: 'Invalid username or password' });
      }

      // Generate JWT token immediately (no verification needed)
      const token = jwt.sign({ id: user.id, username: user.username, isAdmin: user.isAdmin }, JWT_SECRET, {
        expiresIn: '7d'
      });

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name || user.username,
          isAdmin: user.isAdmin ? true : false
        }
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Verify Code
// Verify endpoint - no longer used (immediate login without verification)
// app.post('/api/auth/verify', (req, res) => {
//   res.status(400).json({ error: 'Verification no longer required. Use signin for direct login.' });
// });

// ============================================
// UPLOAD ROUTES
// ============================================

// Middleware: Verify JWT token
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Get all uploads with average ratings (filtered by status)
app.get('/api/uploads', (req, res) => {
  const status = req.query.status || 'published';
  const userId = req.query.userId;

  let query = `SELECT id, title, author, synopsis, genre, uploadedBy, uploadedAt, status FROM uploads WHERE status = ?`;
  const params = [status];

  // If userId provided, filter to only that user's uploads
  if (userId) {
    query += ` AND uploadedBy = ?`;
    params.push(userId);
  }

  query += ` ORDER BY uploadedAt DESC LIMIT 50`;

  db.all(query, params, async (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching uploads' });
    }
    
    const uploadsWithRatings = await Promise.all(
      (rows || []).map(upload => {
        return new Promise((resolve) => {
          db.get(
            `SELECT AVG(rating) as avgRating, COUNT(*) as totalRatings FROM ratings WHERE uploadId = ?`,
            [upload.id],
            (err, ratingData) => {
              resolve({
                ...upload,
                avgRating: ratingData && ratingData.avgRating ? parseFloat(ratingData.avgRating).toFixed(1) : 0,
                totalRatings: ratingData ? ratingData.totalRatings : 0
              });
            }
          );
        });
      })
    );
    
    res.json(uploadsWithRatings);
  });
});

// Get upload image
app.get('/api/uploads/:id/image', (req, res) => {
  db.get('SELECT image FROM uploads WHERE id = ?', [req.params.id], (err, row) => {
    if (!row) {
      return res.status(404).json({ error: 'Upload not found' });
    }
    res.setHeader('Content-Type', 'image/png');
    res.send(Buffer.from(row.image.split(',')[1], 'base64'));
  });
});

// Create upload (status = pending by default)
app.post('/api/uploads', verifyToken, (req, res) => {
  const { title, image, author, synopsis, genre } = req.body;

  if (!title || !image) {
    return res.status(400).json({ error: 'Title and image required' });
  }

  const uploadId = uuidv4();

  db.run(
    'INSERT INTO uploads (id, title, image, uploadedBy, author, synopsis, genre, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [uploadId, title, image, req.user.id, author || '', synopsis || '', genre || '', 'pending'],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error creating upload' });
      }
      res.json({ success: true, id: uploadId });
    }
  );
});

// Delete upload (users can delete pending; admin can delete published)
app.delete('/api/uploads/:id', verifyToken, (req, res) => {
  const uploadId = req.params.id;

  db.get('SELECT uploadedBy, status FROM uploads WHERE id = ?', [uploadId], (err, upload) => {
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    // Admin can delete any upload
    const isAdmin = req.user.isAdmin === true;
    // Users can delete their own pending uploads
    const isOwnerOfPending = upload.uploadedBy === req.user.id && upload.status === 'pending';

    if (!isAdmin && !isOwnerOfPending) {
      return res.status(403).json({ error: 'You can only delete your own pending submissions' });
    }

    db.run('DELETE FROM ratings WHERE uploadId = ?', [uploadId], (ratingErr) => {
      if (ratingErr) {
        return res.status(500).json({ error: 'Error deleting upload ratings' });
      }

      db.run('DELETE FROM uploads WHERE id = ?', [uploadId], (uploadErr) => {
        if (uploadErr) {
          return res.status(500).json({ error: 'Error deleting upload' });
        }

        res.json({ success: true, message: 'Upload deleted' });
      });
    });
  });
});

// Edit pending upload (users only)
app.put('/api/uploads/:id', verifyToken, (req, res) => {
  const uploadId = req.params.id;
  const { title, image, author, synopsis, genre } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  db.get('SELECT uploadedBy, status FROM uploads WHERE id = ?', [uploadId], (err, upload) => {
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    // Only owner can edit their pending uploads
    if (upload.uploadedBy !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own uploads' });
    }

    if (upload.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending uploads can be edited' });
    }

    const updateQuery = image
      ? 'UPDATE uploads SET title = ?, author = ?, synopsis = ?, genre = ?, image = ? WHERE id = ?'
      : 'UPDATE uploads SET title = ?, author = ?, synopsis = ?, genre = ? WHERE id = ?';
    
    const updateParams = image
      ? [title, author || '', synopsis || '', genre || '', image, uploadId]
      : [title, author || '', synopsis || '', genre || '', uploadId];

    db.run(updateQuery, updateParams, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error updating upload' });
      }

      res.json({ success: true, id: uploadId });
    });
  });
});

// Publish pending upload (admin only - instant publish)
app.post('/api/uploads/:id/publish', verifyToken, (req, res) => {
  const uploadId = req.params.id;

  // Admin check
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Only admins can publish uploads' });
  }

  db.get('SELECT status FROM uploads WHERE id = ?', [uploadId], (err, upload) => {
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    if (upload.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending uploads can be published' });
    }

    db.run('UPDATE uploads SET status = ? WHERE id = ?', ['published', uploadId], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error publishing upload' });
      }

      // Return updated upload
      db.get(
        'SELECT id, title, author, synopsis, genre, uploadedBy, uploadedAt, status FROM uploads WHERE id = ?',
        [uploadId],
        (err, updated) => {
          if (err) {
            return res.status(500).json({ error: 'Error fetching updated upload' });
          }
          res.json({ success: true, upload: updated });
        }
      );
    });
  });
});

// Reject pending upload (admin only - delete it)
app.post('/api/uploads/:id/reject', verifyToken, (req, res) => {
  const uploadId = req.params.id;

  // Admin check
  if (req.user.email !== ADMIN_EMAIL && !req.user.isAdmin) {
    return res.status(403).json({ error: 'Only admins can reject uploads' });
  }

  db.get('SELECT status FROM uploads WHERE id = ?', [uploadId], (err, upload) => {
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    if (upload.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending uploads can be rejected' });
    }

    db.run('DELETE FROM ratings WHERE uploadId = ?', [uploadId], (ratingErr) => {
      if (ratingErr) {
        return res.status(500).json({ error: 'Error rejecting upload' });
      }

      db.run('DELETE FROM uploads WHERE id = ?', [uploadId], (uploadErr) => {
        if (uploadErr) {
          return res.status(500).json({ error: 'Error rejecting upload' });
        }

        res.json({ success: true, message: 'Upload rejected and removed' });
      });
    });
  });
});

// Post a rating
app.post('/api/ratings', verifyToken, (req, res) => {
  const { uploadId, rating } = req.body;

  if (!uploadId || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Valid uploadId and rating (1-5) required' });
  }

  const ratingId = uuidv4();

  db.run(
    `INSERT OR REPLACE INTO ratings (id, uploadId, userId, rating) VALUES (?, ?, ?, ?)`,
    [ratingId, uploadId, req.user.id, rating],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error saving rating' });
      }

      // Get updated average
      db.get(
        `SELECT AVG(rating) as avgRating, COUNT(*) as totalRatings FROM ratings WHERE uploadId = ?`,
        [uploadId],
        (err, result) => {
          res.json({
            success: true,
            avgRating: result.avgRating ? parseFloat(result.avgRating).toFixed(1) : 0,
            totalRatings: result.totalRatings
          });
        }
      );
    }
  );
});

// Get rating for current user on specific upload
app.get('/api/ratings/:uploadId', verifyToken, (req, res) => {
  db.get(
    `SELECT rating FROM ratings WHERE uploadId = ? AND userId = ?`,
    [req.params.uploadId, req.user.id],
    (err, row) => {
      res.json({ rating: row ? row.rating : 0 });
    }
  );
});

// ============================================
// PROFILE ROUTES
// ============================================

// Get user profile
app.get('/api/profile', verifyToken, (req, res) => {
  db.get(
    'SELECT id, username, name, profilePicture, aboutMe, createdAt, isAdmin FROM users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    }
  );
});

// Update user profile
app.put('/api/profile', verifyToken, (req, res) => {
  const { name, aboutMe, profilePicture } = req.body;

  const updateFields = [];
  const updateParams = [];

  if (name !== undefined) {
    updateFields.push('name = ?');
    updateParams.push(name);
  }

  if (aboutMe !== undefined) {
    updateFields.push('aboutMe = ?');
    updateParams.push(aboutMe);
  }

  if (profilePicture !== undefined) {
    updateFields.push('profilePicture = ?');
    updateParams.push(profilePicture);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updateParams.push(req.user.id);

  const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;

  db.run(query, updateParams, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Error updating profile' });
    }

    // Return updated profile
    db.get(
      'SELECT id, username, name, profilePicture, aboutMe, createdAt, isAdmin FROM users WHERE id = ?',
      [req.user.id],
      (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Error fetching updated profile' });
        }
        res.json({ success: true, user });
      }
    );
  });
});

// Get profile picture by user ID
app.get('/api/profile/:userId/picture', (req, res) => {
  db.get('SELECT profilePicture FROM users WHERE id = ?', [req.params.userId], (err, row) => {
    if (!row || !row.profilePicture) {
      return res.status(404).json({ error: 'Profile picture not found' });
    }
    res.setHeader('Content-Type', 'image/png');
    res.send(Buffer.from(row.profilePicture.split(',')[1], 'base64'));
  });
});

// ============================================
// START SERVER
// ============================================

async function startServer() {
  // Ensure admin account exists
  await ensureAdminExists();
  
  app.listen(PORT, () => {
    console.log(`🚀 Comicary server running on http://localhost:${PORT}`);
    console.log(`📁 Database: comicary.db`);
    console.log(`🔐 Admin Account: ${ADMIN_USERNAME}`);
    console.log(`🔐 Remember to set JWT_SECRET in .env for production`);
  });
}

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  db.close(() => {
    console.log('Database connection closed');
    process.exit(0);
  });
});

