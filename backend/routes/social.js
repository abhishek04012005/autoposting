const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const auth = require('../middleware/auth');

dotenv.config();

const router = express.Router();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:5000/api/social/linkedin/callback';

const PINTEREST_APP_ID = process.env.PINTEREST_APP_ID;
const PINTEREST_APP_SECRET = process.env.PINTEREST_APP_SECRET;
const PINTEREST_REDIRECT_URI = process.env.PINTEREST_REDIRECT_URI || 'http://localhost:5000/api/social/pinterest/callback';

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:5000/api/social/facebook/callback';

function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64');
  const codeChallenge = hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return { codeVerifier, codeChallenge };
}

router.get('/connect/linkedin', auth, (req, res) => {
  const { codeVerifier, codeChallenge } = generatePKCE();
  req.session.codeVerifier = codeVerifier;
  // req.session.userId = req.user.sub; // Remove, use state instead

  const url =
    'https://www.linkedin.com/oauth/v2/authorization' +
    `?response_type=code` +
    `&client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=openid%20profile%20email` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256` +
    `&state=${req.user.sub}`;

  res.json({ url });
});


router.get('/linkedin/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  const codeVerifier = req.session.codeVerifier;
  const userId = state; // Use state instead of session

  if (!code || !codeVerifier || !userId) {
    return res.status(400).send('Missing code, verifier, or user session');
  }

  try {
    const tokenResponse = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      null,
      {
        params: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code_verifier: codeVerifier,
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Store in Supabase
    const { error } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: userId,
        platform: 'linkedin',
        access_token: accessToken,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error storing account:', error);
      return res.status(500).send('Failed to store account');
    }

    // Clear session
    req.session.codeVerifier = null;
    // req.session.userId = null;

    // Redirect to dashboard
    res.redirect('http://localhost:5173/dashboard');
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('LinkedIn authentication failed');
  }
});

router.get('/connect/pinterest', auth, (req, res) => {
  const url =
    'https://www.pinterest.com/oauth/authorize' +
    `?response_type=code` +
    `&client_id=${PINTEREST_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(PINTEREST_REDIRECT_URI)}` +
    `&scope=user_accounts:read,pins:write,boards:read` +
    `&state=${req.user.sub}`;

  res.json({ url });
});

router.get('/connect/facebook', auth, (req, res) => {
  const url =
    'https://www.facebook.com/v12.0/dialog/oauth' +
    `?client_id=${FACEBOOK_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(FACEBOOK_REDIRECT_URI)}` +
    `&scope=pages_manage_posts,pages_read_engagement,pages_show_list,email` +
    `&response_type=code` +
    `&state=${req.user.sub}`;

  res.json({ url });
});

router.get('/pinterest/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  const userId = state;

  if (!code || !userId) {
    return res.status(400).send('Missing code or user session');
  }

  try {
    const tokenResponse = await axios.post(
      'https://api.pinterest.com/v5/oauth/token',
      null,
      {
        params: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: PINTEREST_REDIRECT_URI,
        },
        auth: {
          username: PINTEREST_APP_ID,
          password: PINTEREST_APP_SECRET,
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Store in Supabase
    const { error } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: userId,
        platform: 'pinterest',
        access_token: accessToken,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error storing account:', error);
      return res.status(500).send('Failed to store account');
    }

    // Redirect to dashboard
    res.redirect('http://localhost:5173/dashboard');
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('Pinterest authentication failed');
  }
});

router.get('/facebook/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  const userId = state;

  if (!code || !userId) {
    return res.status(400).send('Missing code or user session');
  }

  try {
    const tokenResponse = await axios.get(
      'https://graph.facebook.com/v12.0/oauth/access_token',
      {
        params: {
          client_id: FACEBOOK_APP_ID,
          client_secret: FACEBOOK_APP_SECRET,
          redirect_uri: FACEBOOK_REDIRECT_URI,
          code,
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Store in Supabase
    const { error } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: userId,
        platform: 'facebook',
        access_token: accessToken,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error storing account:', error);
      return res.status(500).send('Failed to store account');
    }

    // Redirect to dashboard
    res.redirect('http://localhost:5173/dashboard');
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('Facebook authentication failed');
  }
});

router.get('/accounts', auth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    if (!userId) {
      return res.status(400).json({ error: 'No user ID in token' });
    }

    const { data, error } = await supabase
      .from('social_accounts')
      .select('id, platform, created_at')
      .eq('user_id', userId);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch accounts', details: error.message });
    }

    res.json(data || []);
  } catch (err) {
    console.error('Accounts endpoint error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

router.get('/connect/youtube', auth, (req, res) => {
  const { google } = require('googleapis');
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:5000/api/social/youtube/callback'
  );

  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: req.user.sub
  });

  res.json({ url });
});

router.get('/youtube/callback', async (req, res) => {
  try {
    const { google } = require('googleapis');
    const code = req.query.code;
    const state = req.query.state;
    const userId = state;

    if (!code || !userId) {
      return res.status(400).send('Missing code or user session');
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:5000/api/social/youtube/callback'
    );

    const { tokens } = await oauth2Client.getToken(code);

    // Store in Supabase
    const { error } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: userId,
        platform: 'youtube',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error storing account:', error);
      return res.status(500).send('Failed to store account');
    }

    res.redirect('http://localhost:5173/dashboard');
  } catch (error) {
    console.error('YouTube auth error:', error);
    res.status(500).send('YouTube authentication failed');
  }
});

module.exports = router;
