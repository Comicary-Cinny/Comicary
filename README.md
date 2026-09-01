# 🎨 Comicary - Webtoon Reader with Authentication

A full-stack web application for uploading, browsing, and managing webtoon/comic titles with real user authentication.

## 🚀 Quick Start

### Prerequisites
- Node.js v14+ and npm

### Installation & Running

```bash
# Install dependencies
npm install

# Start the backend server
npm start
```

The server will run on **http://localhost:3000** and serve the frontend at the root path.

### Access the App
- Open **http://localhost:3000** in your browser
- Click "Sign Up" to create an account
- Check your email for a 6-digit verification code
- Once verified, upload your comic titles!

---

## 🔐 Authentication Features

### Sign Up / Sign In
- Email-based authentication with password hashing (bcryptjs)
- 6-digit email verification codes sent via Ethereal (test) or real SMTP
- JWT token-based sessions (7-day expiry)
- Automatic login for returning users

### Email Verification
- **Development Mode**: Uses Ethereal test email service
  - Emails are not real but accessible via preview URLs in console
  - Demo codes work instantly without waiting for emails
  
- **Production Mode**: Configure in `.env`
  - Gmail SMTP
  - SendGrid
  - Any SMTP provider

---

## 📁 Project Structure

```
comicary/
├── server.js              # Express backend server
├── package.json           # Dependencies & scripts
├── .env                   # Configuration (JWT_SECRET, SMTP settings)
├── comicary.db           # SQLite database (auto-created)
└── public/
    ├── index.html        # Frontend UI
    ├── script.js         # Authentication & app logic
    └── style.css         # Styling
```

---

## 🗄️ Database Schema

### Users Table
- `id`: UUID primary key
- `email`: Unique email address
- `password`: Hashed password
- `name`: User display name
- `isVerified`: Account verification status
- `createdAt`: Account creation timestamp

### Verification Codes Table
- `id`: UUID
- `email`: User email
- `code`: 6-digit verification code
- `expiresAt`: Code expiry time (10 minutes)
- `attempts`: Failed attempt count

### Uploads Table
- `id`: UUID
- `title`: Comic title name
- `image`: Base64-encoded image data
- `uploadedBy`: User email
- `uploadedAt`: Upload timestamp

---

## 🔌 API Endpoints

### Authentication

**POST `/api/auth/signup`**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**POST `/api/auth/signin`**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**POST `/api/auth/verify`**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```
Returns: `{ token, user: { id, email, name } }`

### Uploads

**GET `/api/uploads`**
- Get all uploaded titles (max 50)
- Returns array of uploads with metadata

**POST `/api/uploads`**
- Requires: `Authorization: Bearer <token>` header
- Body: `{ title, image: "data:image/png;base64,..." }`

**GET `/api/uploads/:id/image`**
- Retrieve encoded image for a specific upload

---

## ⚙️ Configuration (.env)

```env
# Server
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-here

# Email (optional - uses Ethereal by default)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

---

## 🧪 Testing the App

### Default Test Flow
1. **Sign Up**: Create account with any email & password (6+ chars)
2. **Email Verification**: Copy 6-digit code from Ethereal preview link
3. **Upload**: Add comic titles with cover images
4. **Browse**: View all uploaded titles
5. **Recognize Users**: Refresh page - you stay logged in!

### Test Credentials
```
Email: test@example.com
Password: password123
```

---

## 🛡️ Security Features

✅ **Password Hashing**: bcryptjs (10-salt rounds)
✅ **JWT Tokens**: 7-day expiry, signed with secret
✅ **CORS**: Enabled for localhost
✅ **Email Verification**: Required for account activation
✅ **Token Authorization**: Required for uploads
✅ **Input Validation**: Email format & password length checks

---

## 📧 Email Service Setup

### Development (Default - Ethereal)
No setup needed! Emails show up in console preview links.

### Production (Gmail SMTP)
1. Enable 2-Factor Authentication in Gmail
2. Generate App Password
3. Update `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
NODE_ENV=production
```

---

## 🐛 Troubleshooting

**"Cannot connect to server"**
- Make sure `npm start` is running
- Check port 3000 is not blocked
- Verify API_URL in public/script.js

**"Email not received"**
- In dev mode, check console for Ethereal preview link
- In production, verify SMTP settings in .env

**"Verification code invalid"**
- Codes expire after 10 minutes
- Request a new code by signing in again

---

## 📝 Notes

- Images are stored as base64 in SQLite (fine for small projects, use S3/CDN for production)
- Session tokens expire after 7 days (configurable in server.js)
- Database stores all users and uploads permanently until .db file is deleted

---

## 📄 License

MIT - Free to use for personal and commercial projects
