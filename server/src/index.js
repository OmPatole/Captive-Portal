require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios'); // Install this: npm install axios

const app = express();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.use(cors());
app.use(express.json());

// --- Ruckus API Config (Fill these in .env) ---
const RUCKUS_SZ_IP = process.env.RUCKUS_SZ_IP || '192.168.1.100'; // Your Controller IP
const RUCKUS_ADMIN = process.env.RUCKUS_ADMIN || 'admin';
const RUCKUS_PASS = process.env.RUCKUS_PASS || 'password';
const RUCKUS_ZONE_ID = process.env.RUCKUS_ZONE_ID || 'your-zone-id'; 

// --- Helper: Generate Guest Pass on Ruckus ---
async function generateGuestPass(userName, userMac) {
  // NOTE: This is a simplified logic for Ruckus SmartZone (SZ) API.
  // Consult your specific controller version docs (v5/v6/v9) for exact endpoints.
  
  try {
    // 1. Login to Ruckus to get Cookie/Token
    // (This is a simplified example. In production, cache the token.)
    // const authRes = await axios.post(`https://${RUCKUS_SZ_IP}:8443/wsg/api/public/v9_1/serviceTicket`, { 
    //   username: RUCKUS_ADMIN, password: RUCKUS_PASS 
    // });
    // const cookie = authRes.data.serviceTicket;

    // 2. Create Guest Pass (10 Minutes Validity)
    // const passRes = await axios.post(`https://${RUCKUS_SZ_IP}:8443/wsg/api/public/v9_1/rksjoines/guestpass`, {
    //   guestpass_name: userName,
    //   duration: 10, // Minutes
    //   duration_type: "Minutes",
    //   wlan_id: "your-wlan-id" 
    // }, { headers: { Cookie: cookie } });

    // return passRes.data.guestpass_key;

    // MOCK FOR DEVELOPMENT:
    console.log(`[Mock] Generating pass for ${userName} (${userMac})`);
    return `PASS-${Math.floor(Math.random() * 100000)}`; 

  } catch (error) {
    console.error("Ruckus API Error:", error.message);
    throw new Error("Failed to generate Wi-Fi pass");
  }
}

app.post('/api/auth/google', async (req, res) => {
  const { token, mac } = req.body; // Client sends MAC now
  if (!token) return res.status(400).json({ error: "Token required" });

  try {
    // 1. Google Verification
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const user = { 
      name: payload.name, 
      email: payload.email, 
      picture: payload.picture 
    };

    // 2. Generate Ruckus Guest Pass
    // Only generate if we have a MAC (meaning user is actually on Wi-Fi)
    let guestPass = null;
    if (mac) {
      guestPass = await generateGuestPass(user.name, mac);
    }

    // 3. Send info back (Client will use guestPass to auto-submit form)
    res.json({ success: true, user, guestPass });
    
  } catch (error) {
    console.error("Verification Error:", error.message);
    res.status(401).json({ error: "Invalid token" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));