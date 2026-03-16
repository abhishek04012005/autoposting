const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const upload = multer({ storage: multer.memoryStorage() });

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Google Drive setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function uploadToGoogleDrive(file) {
  const fileMetadata = {
    name: file.originalname,
  };
  const media = {
    mimeType: file.mimetype,
    body: require('stream').Readable.from(file.buffer),
  };
  const response = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id,webViewLink',
  });
  // Make file public
  await drive.permissions.create({
    fileId: response.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });
  return { id: response.data.id, url: response.data.webViewLink };
}

router.post('/create', auth, upload.single('media'), async (req, res) => {
  try {
    const { content, platforms, scheduledAt } = req.body;
    const userId = req.user.sub;
    
    // Validate required fields
    if (!userId) {
      return res.status(400).json({ error: 'User ID not found in token' });
    }

    // Validate platforms
    let platformsList = [];
    if (platforms) {
      try {
        platformsList = JSON.parse(platforms);
        if (!Array.isArray(platformsList) || platformsList.length === 0) {
          return res.status(400).json({ error: 'Please select at least one platform' });
        }
      } catch (parseError) {
        return res.status(400).json({ error: 'Invalid platforms format' });
      }
    } else {
      return res.status(400).json({ error: 'Please select at least one platform' });
    }

    let finalContent = content;

    if (!content && !req.file) {
      // Generate AI content
      const prompt = 'Generate an engaging social media post about technology.';
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
      });
      finalContent = response.choices[0].message.content;
    }

    let mediaUrl = null;
    let googleDriveFileId = null;
    let localMediaPath = null;

    if (req.file) {
      try {
        // Save file to disk for YouTube upload
        const fileName = `${Date.now()}-${req.file.originalname}`;
        localMediaPath = path.join(uploadsDir, fileName);
        fs.writeFileSync(localMediaPath, req.file.buffer);
        console.log('File saved locally for YouTube:', localMediaPath);

        // Upload to Google Drive (for backup/reference)
        const driveData = await uploadToGoogleDrive(req.file);
        mediaUrl = driveData.url;
        googleDriveFileId = driveData.id;
      } catch (uploadError) {
        console.error('Media upload error:', uploadError.message);
        return res.status(400).json({ error: 'Failed to upload media: ' + uploadError.message });
      }
    }

    const { data, error } = await supabase
      .from('posts')
      .insert([{ 
        user_id: userId, 
        content: finalContent, 
        media_url: mediaUrl, 
        local_media_path: localMediaPath, 
        google_drive_file_id: googleDriveFileId, 
        platforms: platformsList, 
        scheduled_at: scheduledAt || null, 
        status: scheduledAt ? 'scheduled' : 'posted' 
      }]);
    
    if (error) {
      console.error('Database insert error:', error);
      return res.status(400).json({ error: error.message || 'Failed to create post' });
    }
    
    // If no scheduled time, post immediately
    if (!scheduledAt && data && data.length > 0) {
      try {
        const { publishPost } = require('../utils/publish');
        const postToPublish = {
          ...data[0],
          platforms: platformsList
        };
        await publishPost(postToPublish);
        console.log('Post published immediately to:', platformsList);
      } catch (publishError) {
        console.error('Error publishing post immediately:', publishError.message);
      }
    }
    
    res.json({ message: 'Post created' + (!scheduledAt ? ' and posted!' : ' and scheduled!') });
  } catch (err) {
    console.error('Unexpected error in /create:', err);
    res.status(400).json({ error: err.message || 'Failed to create post' });
  }
});

module.exports = router;