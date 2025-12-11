Wi-Fi Captive Portal Authentication System
A full-stack captive portal solution designed for university or enterprise networks (specifically Ruckus SmartZone controllers). This system authenticates users via Google OAuth, enforces session limits, tracks usage via Firebase, and authorizes devices on the network.

🌟 Features
Google OAuth Integration: Secure sign-in using institutional or personal Google accounts.

Ruckus SmartZone Integration: Auto-detects client_mac and Controller IP (uip/sip) from the redirect URL to authorize devices.

Access Control:

Daily Limits: Limits users to 3 logins per day.

Cooldowns: Enforces a 10-minute cooldown between sessions.

Session Timer: Visual countdown for internet session expiry (default 10 mins).

Admin Dashboard: Real-time view of active/inactive users and access logs.

Firebase Backend: Stores user data, access logs, and admin privileges in Firestore.

Mock Controller API: The server currently mocks the Ruckus API response for development purposes.

🛠 Tech Stack
Client (Frontend)
Framework: React + Vite

Auth: @react-oauth/google

Database: Firebase Firestore

Styling: CSS Modules (Responsive Design)

Server (Backend)
Runtime: Node.js + Express

Auth Verification: google-auth-library

Network Requests: axios (for Ruckus API communication)

🚀 Setup & Installation
Prerequisites
Node.js (v18+)

A Firebase Project (Firestore enabled)

A Google Cloud Console Project (OAuth 2.0 Client ID)

1. Backend Setup (/server)
The backend verifies Google tokens and communicates with the Wi-Fi controller.

Bash

cd server
npm install
Configuration: Create a .env file in the server/ directory based on the provided sample:

Code snippet

PORT=3000
# Google Cloud Console Credentials
GOOGLE_CLIENT_ID=your_google_client_id

# Ruckus Controller Config (Optional for Dev/Mock)
RUCKUS_SZ_IP=192.168.1.100
RUCKUS_ADMIN=admin
RUCKUS_PASS=password
RUCKUS_ZONE_ID=your-zone-id
Start Server:

Bash

node src/index.js
2. Frontend Setup (/client)
The frontend handles the user interface and logic.

Bash

cd client
npm install
Configuration: Create a .env file in the client/ directory based on the provided sample:

Code snippet

VITE_API_URL=http://localhost:3000

# Google Client ID (Must match backend)
VITE_GOOGLE_CLIENT_ID=your_google_client_id

# Firebase Config
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
Start Client:

Bash

npm run dev
🗄️ Database Structure (Firestore)
The application relies on three main collections in Firebase:

users: Stores user profiles and daily usage counters.

email (ID), dailyLoginCount, lastLogin, loginDate.

admins: Stores admin emails.

Create a document where ID = admin@example.com to grant admin access.

user_logs / admin_logs: Historical access logs displayed in the dashboard.

⚙️ How It Works
User Connection: The user connects to the Wi-Fi. The Ruckus controller redirects them to this portal with parameters: ?client_mac=XX:XX...&uip=192.168....

Login: User clicks "Sign in with Google".

Verification:

Client sends Google Token + MAC address to the Node.js Server.

Server verifies token with Google.

Authorization:

Server (Mock) generates a Guest Pass.

Client receives the pass, checks Firebase for cooldowns/limits.

Access Granted:

If checks pass, the client auto-submits a hidden form to the Ruckus Controller IP to authenticate the device.

A 10-minute timer begins on the UI.
