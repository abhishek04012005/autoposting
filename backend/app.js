const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');

// Load environment variables from the project root .env (backend/ is a subfolder)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { publishPost } = require('./utils/publish');

const app = express();
const PORT = process.env.PORT || 5000;

// Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Middleware
app.use(cors({ 
  credentials: true, 
  origin: (origin, callback) => {
    // Allow localhost on any port, and production domains
    if (!origin || origin.startsWith('http://localhost:') || origin === 'http://localhost') {
      callback(null, true);
    } else if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      callback(null, true);
    } else {
      callback(null, true); // Allow for now, restrict in production
    }
  }
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/social', require('./routes/social'));
app.use('/api/posts', require('./routes/posts'));

// Debug endpoint - check scheduled posts
app.get('/api/debug/scheduled-posts', async (req, res) => {
  try {
    // Get current time in UTC and convert for IST reference
    const nowUTC = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const nowIST = new Date(nowUTC.getTime() + istOffsetMs);
    const now = nowUTC.toISOString();
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'scheduled')
      .order('scheduled_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const result = {
      current_time_utc: now,
      current_time_ist: nowIST.toISOString(),
      total_scheduled_posts: posts ? posts.length : 0,
      posts: posts ? posts.map(p => {
        // Convert UTC scheduled_at to IST for display
        // p.scheduled_at may come with timezone offset from Supabase, parse as UTC
        const scheduledUTC = new Date(p.scheduled_at);
        // To display in IST (UTC+5:30), add 5.5 hours to the UTC timestamp
        const scheduledIST = new Date(scheduledUTC.getTime() + istOffsetMs);
        // Format IST time in readable format
        const istFormatted = scheduledIST.toLocaleString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata'
        });
        return {
          id: p.id,
          scheduled_at_utc: p.scheduled_at,
          scheduled_at_ist: scheduledIST.toISOString(),
          scheduled_at_ist_formatted: istFormatted,
          is_ready: p.scheduled_at <= now,
          user_id: p.user_id,
          platforms: p.platforms
        };
      }) : []
    };

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cron job for publishing posts
// Run every 5 minutes instead of every minute to reduce network load
cron.schedule('*/5 * * * *', async () => {
  try {
    // Get current time in UTC (stored time is in UTC)
    const now = new Date().toISOString();
    // Also log IST for reference
    const istOffsetMs = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const nowIST = new Date(new Date().getTime() + istOffsetMs);
    console.log(`[CRON] Running scheduled posts check at ${now} (IST: ${nowIST.toISOString()})`);
    
    // Check for pending posts that should be published
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true });

    if (error) {
      console.error('[CRON] Error fetching posts:', error.message);
      return;
    }

    if (!posts || posts.length === 0) {
      console.log('[CRON] No scheduled posts ready to publish');
      return;
    }

    console.log(`[CRON] Found ${posts.length} post(s) to publish`);

    // Process each post
    for (const post of posts) {
      try {
        console.log(`[CRON] Publishing post ${post.id} to platforms:`, post.platforms);
        await publishPost(post);
        
        // Update post status to published
        await supabase
          .from('posts')
          .update({ status: 'published', posted_at: new Date().toISOString() })
          .eq('id', post.id);
        
        console.log(`[CRON] Successfully published post ${post.id}`);
      } catch (publishError) {
        console.error(`[CRON] Error publishing post ${post.id}:`, publishError.message);
        // Mark as failed
        await supabase
          .from('posts')
          .update({ status: 'failed' })
          .eq('id', post.id);
      }
    }
  } catch (err) {
    console.error('[CRON] Cron job error:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});