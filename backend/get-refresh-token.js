require('dotenv').config({ path: '../.env' });
const { google } = require("googleapis");

// Debug: Check if env vars are loaded
console.log("CLIENT_ID loaded:", !!process.env.GOOGLE_CLIENT_ID);
console.log("CLIENT_SECRET loaded:", !!process.env.GOOGLE_CLIENT_SECRET);

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error("❌ Error: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not found in .env");
  console.error("Make sure .env file exists in the parent directory");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:5000/api/social/google/callback"
);

// Get the code from command line argument
const code = process.argv[2];

if (!code) {
  console.log("Usage: node get-refresh-token.js <AUTHORIZATION_CODE>");
  process.exit(1);
}

console.log("Exchanging code for token...");
oauth2Client.getToken(code)
  .then(({ tokens }) => {
    console.log("\n✅ SUCCESS! Here's your refresh token:\n");
    console.log("GOOGLE_REFRESH_TOKEN=" + tokens.refresh_token);
    console.log("\nAccess Token:", tokens.access_token);
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ Error:", err.message);
    if (err.message.includes("invalid_grant")) {
      console.error("\n⚠️  Authorization code expired or invalid.");
      console.error("Get a fresh code and try again immediately.");
    }
    process.exit(1);
  });