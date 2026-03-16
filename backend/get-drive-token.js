const { google } = require('googleapis');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Use localhost for web applications - Google will redirect here with the auth code
const REDIRECT_URI = 'http://localhost:5000';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Scopes for both YouTube upload and Google Drive access
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file'
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Simple localhost server to handle callback
const http = require('http');
let server = null;

function startCallbackServer() {
  return new Promise((resolve) => {
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost:5000');
      const code = url.searchParams.get('code');
      
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>✓ Authorization Successful!</h1>
              <p>You can close this window and return to the terminal.</p>
            </body>
          </html>
        `);
        server.close();
        resolve(code);
      } else {
        res.writeHead(400);
        res.end('No authorization code received');
      }
    }).listen(5000, () => {
      console.log('Callback server listening on http://localhost:5000');
    });
  });
}

async function getNewToken() {
  try {
    // Generate authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    console.log('\n✓ Google OAuth Setup\n');
    console.log('1. A browser window should open automatically...');
    console.log('2. If not, visit this URL:\n');
    console.log(`   ${authUrl}\n`);
    console.log('3. Grant permission to access YouTube and Google Drive\n');

    // Start listening for callback
    const code = await startCallbackServer();

    try {
      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      
      if (!tokens.refresh_token) {
        console.error('✗ No refresh token received.');
        rl.close();
        return;
      }

      console.log('\n✓ Successfully generated refresh token!');
      console.log(`\nRefresh Token:\n${tokens.refresh_token}\n`);

      // Ask if user wants to update .env
      rl.question('Update .env file with this token? (y/n): ', (answer) => {
        if (answer.toLowerCase() === 'y') {
          const envPath = path.resolve(__dirname, '../.env');
          let envContent = fs.readFileSync(envPath, 'utf8');
          
          // Replace or add GOOGLE_REFRESH_TOKEN
          if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
            envContent = envContent.replace(
              /GOOGLE_REFRESH_TOKEN=.*/,
              `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`
            );
          } else {
            envContent += `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`;
          }
          
          fs.writeFileSync(envPath, envContent);
          console.log('✓ .env file updated successfully!');
          console.log('✓ Restart your backend to apply changes: pkill -f "node app.js"');
        } else {
          console.log('\nManually update .env with:');
          console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
        }
        rl.close();
      });
    } catch (error) {
      console.error('✗ Error exchanging code for tokens:');
      console.error(error.message);
      rl.close();
    }
  } catch (error) {
    console.error('✗ Error generating authorization URL:');
    console.error(error.message);
    rl.close();
  }
}

console.log('Generating Google OAuth authorization URL...\n');
getNewToken();
