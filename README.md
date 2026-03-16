# AutoSocial AI

A full-stack SaaS application for automated social media posting across multiple platforms.

## Features

- User authentication with JWT tokens
- Multi-platform OAuth 2.0 integration:
  - **LinkedIn** (OpenID Connect with PKCE)
  - **Pinterest** (v5 API)
  - **YouTube** (via Google OAuth with video upload)
  - **Google** (for YouTube integration via refresh token)
- Post creation with platform selection
- Scheduled posting with node-cron
- Supabase for user and account data persistence
- Token refresh and automatic OAuth callback handling

## Tech Stack

- **Frontend**: React 19.2.0 with Vite, axios for HTTP requests
- **Backend**: Express.js with JWT middleware
- **Database**: Supabase (PostgreSQL)
- **OAuth**: Google Cloud OAuth 2.0 app (for YouTube/Google)
- **Libraries**: googleapis, jsonwebtoken, bcryptjs, node-cron

## Prerequisites

- Node.js (v14+) and npm
- Supabase account (free tier works)
- Google Cloud project with OAuth credentials (for YouTube posting)
- (Optional) LinkedIn, Pinterest developer credentials for additional platforms

## Setup Instructions

### 1. Environment Setup
```bash
# Copy example env file
cp .env.example .env

# Edit .env with your credentials
# Real credentials needed:
# - SUPABASE_URL and SUPABASE_ANON_KEY: From your Supabase project settings
# - JWT_SECRET: Already provided (or generate your own)
# - SESSION_SECRET: Already provided (or generate your own)
# - YOUTUBE_CLIENT_ID/SECRET: From Google Cloud OAuth app
# - GOOGLE_REFRESH_TOKEN: Generated from YouTube OAuth flow (see below)

# Placeholder credentials (to obtain):
# - LINKEDIN_CLIENT_ID/SECRET: Create LinkedIn Developer app
# - PINTEREST_APP_ID/SECRET: Create Pinterest Developer app
```

### 2. Database Setup
```sql
-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Create social_accounts table
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  user_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- Create posts table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  platforms TEXT[] DEFAULT '{}',
  media_url TEXT,
  local_media_path TEXT,
  google_drive_file_id TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'posted', 'failed')),
  scheduled_at TIMESTAMP,
  posted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);
```

### 3. Google OAuth Setup (for YouTube)
```bash
1. Go to https://console.cloud.google.com
2. Create new project
3. Enable YouTube Data API v3 and Google Drive API
4. Create OAuth 2.0 Web Application credentials
5. Add authorized redirect URI: http://localhost:5000/api/social/youtube/callback
6. Copy Client ID and Secret to .env as YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET
7. Generate refresh token:
   - Run: node backend/get-refresh-token.js <authorization_code>
   - Or use: https://developers.google.com/oauthplayground
8. Add GOOGLE_REFRESH_TOKEN to .env
```

### 4. LinkedIn OAuth Setup (Optional)
```bash
1. Go to https://www.linkedin.com/developers/apps
2. Create new app
3. Get Client ID and Secret
4. Add authorized redirect URI: http://localhost:5000/api/social/linkedin/callback
5. Update LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env
```

### 5. Pinterest OAuth Setup (Optional)
```bash
1. Go to https://developers.pinterest.com
2. Create app
3. Get App ID and Secret
4. Add redirect URI: http://localhost:5000/api/social/pinterest/callback
5. Update PINTEREST_APP_ID and PINTEREST_APP_SECRET in .env
```

### 6. Install Dependencies & Run

```bash
# Backend
cd backend
npm install
node app.js
# Backend runs on http://localhost:5000

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:5174
```

## Timezone Handling

**Important**: All scheduled posting times are handled in **Indian Standard Time (IST, UTC+5:30)**.

- **Frontend**: When you select a schedule time using the datetime-local input, it's automatically treated as IST and converted to UTC for storage in Supabase
- **Backend**: The cron job (running every 5 minutes) automatically compares scheduled times against UTC, which corresponds to the stored values
- **Display**: Schedule times are shown and stored as UTC in the database for consistency, but users always enter and think in IST

### How it works:
1. User enters: `2025-03-16 14:30` in the schedule field (IST)
2. Frontend converts: IST → UTC (2025-03-16 09:00 UTC)
3. Backend stores: UTC timestamp in database
4. Cron checks: Current UTC time against stored UTC scheduled_at
5. When matched: Post is published

Example:
- You enter: March 16, 2:30 PM IST
- System stores: March 16, 9:00 AM UTC
- Post publishes when UTC reaches that time

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login user, returns JWT token
- `GET /api/auth/validate` - Verify current token

### Social Accounts
- `GET /api/social/accounts` - List connected accounts
- `GET /api/social/connect/:platform` - Start OAuth flow
- `GET /api/social/:platform/callback` - OAuth callback handler

### Posts
- `POST /api/posts/create` - Create and post to platforms
- `GET /api/posts` - List user's posts

## Current Status

✅ **Working**: User authentication, JWT validation, Supabase integration, YouTube OAuth and video upload, Pinterest OAuth
🔄 **In Development**: LinkedIn OAuth (awaiting real credentials), scheduling refinements
⚠️ **Testing Needed**: YouTube video upload with real video files

## Testing YouTube Auto-Posting

1. Register/login at http://localhost:5174
2. Click "Connect Platform" → YouTube
3. Complete Google OAuth flow
4. Go to "Create Post" 
5. Select YouTube platform
6. Upload a video file or paste video path
7. Click "Post" to upload to YouTube

## Troubleshooting

**"Invalid credentials" errors**: Ensure .env has correct values from OAuth apps
**"UUID invalid input" error**: Backend likely restarted, try logging in again
**"PKCE code challenge required"**: LinkedIn OAuth requires PKCE flow (already configured)
**YouTube upload fails**: Check file exists, is valid video format, and refresh token is valid

## Deployment

- **Backend**: Deploy to Heroku, Railway, or similar Node.js hosting
- **Frontend**: Deploy to Vercel, Netlify, or similar
- **Database**: Use free Supabase tier (10GB storage included)

## License

MIT