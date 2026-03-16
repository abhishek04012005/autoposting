const axios = require('axios');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from the project root .env (backend/ is a subfolder)
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment. Please copy .env.example to .env and set the values.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function publishPost(post) {
  const { platforms, content, media_url, local_media_path } = post;

  for (const platform of platforms) {
    const { data: account } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', post.user_id)
      .eq('platform', platform)
      .single();

    if (!account) {
      console.log(`No account found for ${platform}`);
      continue;
    }

    switch (platform) {
      case 'facebook':
        await publishToFacebook(account.access_token, content, media_url);
        break;
      case 'instagram':
        await publishToInstagram(account.access_token, content, media_url);
        break;
      case 'linkedin':
        await publishToLinkedIn(account.access_token, content, media_url);
        break;
      case 'pinterest':
        await publishToPinterest(account.access_token, content, media_url);
        break;
      case 'youtube':
        // Use local file path for YouTube if available, otherwise use Google Drive URL
        await publishToYouTube(account.access_token, content, local_media_path || media_url);
        break;
    }
  }
}

async function publishToFacebook(token, content, mediaUrl) {
  try {
    const FB_API_VERSION = 'v18.0';
    const FB_BASE_URL = `https://graph.facebook.com/${FB_API_VERSION}`;
    
    // Convert Google Drive URL to direct download link
    let processedMediaUrl = mediaUrl;
    if (mediaUrl && mediaUrl.includes('drive.google.com')) {
      console.log('Converting Google Drive URL to direct download link...');
      const fileIdMatch = mediaUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (fileIdMatch) {
        const fileId = fileIdMatch[1];
        processedMediaUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
        console.log('Converted URL:', processedMediaUrl);
      }
    }
    
    // First, get the user's pages
    const pagesResponse = await axios.get(`${FB_BASE_URL}/me/accounts`, {
      params: {
        fields: 'id,name,access_token',
        access_token: token
      }
    });
    
    if (!pagesResponse.data.data || pagesResponse.data.data.length === 0) {
      throw new Error('No Facebook Pages found. Please create a Facebook Page and connect it to your account.');
    }
    
    // Use the first page
    const page = pagesResponse.data.data[0];
    const pageAccessToken = page.access_token;
    const pageId = page.id;
    
    console.log(`Posting to Facebook page: ${page.name} (${pageId})`);
    
    if (processedMediaUrl) {
      // Post with photo to page
      const photoResponse = await axios.post(`${FB_BASE_URL}/${pageId}/photos`, {
        message: content,
        url: processedMediaUrl,
        access_token: pageAccessToken
      });
      console.log('Facebook page post created:', photoResponse.data.id);
      return photoResponse.data.id;
    } else {
      // Text post to page
      const postResponse = await axios.post(`${FB_BASE_URL}/${pageId}/feed`, {
        message: content,
        access_token: pageAccessToken
      });
      console.log('Facebook page post created:', postResponse.data.id);
      return postResponse.data.id;
    }
  } catch (error) {
    console.error('Error posting to Facebook:', error.response?.data || error.message);
    
    // Fallback: Provide a manual posting URL
    const fallbackUrl = `https://www.facebook.com/?post=${encodeURIComponent(content)}${mediaUrl ? `&photo=${encodeURIComponent(mediaUrl)}` : ''}`;
    console.log('Fallback URL for manual posting:', fallbackUrl);
    
    throw new Error(`Facebook posting failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

async function publishToInstagram(token, content, mediaUrl) {
  // Instagram API requires container creation, etc. Placeholder
  console.log('Instagram post:', content, mediaUrl);
}

async function publishToLinkedIn(token, content, mediaUrl) {
  // Use LinkedIn API
  console.log('LinkedIn post:', content, mediaUrl);
}

async function publishToPinterest(token, content, mediaUrl) {
  try {
    // Get user's boards to find a default board
    const boardsResponse = await axios.get('https://api.pinterest.com/v5/boards', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const boards = boardsResponse.data.items;
    if (!boards || boards.length === 0) {
      console.error('No Pinterest boards found');
      return;
    }
    const boardId = boards[0].id; // Use first board

    const pinData = {
      board_id: boardId,
      title: content.substring(0, 100), // Title limited to 100 chars
      description: content,
    };

    if (mediaUrl) {
      pinData.media_source = { url: mediaUrl };
    }

    const response = await axios.post('https://api.pinterest.com/v5/pins', pinData, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('Pinterest post created:', response.data);
  } catch (error) {
    console.error('Error posting to Pinterest:', error.response?.data || error.message);
  }
}

async function publishToYouTube(token, content, mediaUrl) {
  try {
    const { google } = require('googleapis');
    const fs = require('fs');
    const path = require('path');
    const axios = require('axios');

    // Use refresh token from environment to get a new access token
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    // Get new access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });

    // Prepare video metadata
    const videoMetadata = {
      snippet: {
        title: content.substring(0, 100),
        description: `${content}\n\nPosted via AutoSocial AI`,
        tags: ['auto-posted', 'autosocial'],
        categoryId: '22' // People & Blogs - change as needed
      },
      status: {
        privacyStatus: 'unlisted',
        madeForKids: false
      }
    };

    // Check if mediaUrl is a valid local file path
    if (mediaUrl && fs.existsSync(mediaUrl)) {
      console.log('Uploading video file from:', mediaUrl);
      
      const fileSize = fs.statSync(mediaUrl).size;
      const fileStream = fs.createReadStream(mediaUrl);

      // Upload video with media
      const response = await youtube.videos.insert({
        part: 'snippet,status',
        notifySubscribers: false,
        requestBody: videoMetadata,
        media: {
          body: fileStream
        }
      });

      console.log('YouTube video uploaded:', response.data.id);
      return response.data.id;
    } else if (mediaUrl) {
      // mediaUrl is a Google Drive URL - we'll note this in the description
      console.log('Google Drive URL provided for YouTube (manual upload needed):', mediaUrl);
      
      const response = await youtube.videos.insert({
        part: 'snippet,status',
        notifySubscribers: false,
        requestBody: {
          ...videoMetadata,
          snippet: {
            ...videoMetadata.snippet,
            description: `${content}\n\nMedia: ${mediaUrl}\n\nPosted via AutoSocial AI`
          }
        }
      });

      console.log('YouTube video metadata created:', response.data.id);
      return response.data.id;
    } else {
      // No media - just create a text post entry
      console.log('No media provided, creating text-only video entry');
      
      const response = await youtube.videos.insert({
        part: 'snippet,status',
        notifySubscribers: false,
        requestBody: videoMetadata
      });

      console.log('YouTube video metadata created:', response.data.id);
      return response.data.id;
    }
  } catch (error) {
    console.error('Error posting to YouTube:', error.message);
    if (error.errors) {
      console.error('YouTube API errors:', error.errors);
    }
    throw error;
  }
}

module.exports = { publishPost };