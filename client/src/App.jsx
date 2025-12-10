import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { verifyGoogleToken } from './services/auth-api';
import { syncUserToDB, checkAdminStatus, checkLoginCooldown } from './services/db'; 
import AdminDashboard from './components/AdminDashboard';

// --- 1. NEW: Timer Component ---
const AccessTimer = ({ expiryTime, onExpire }) => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = expiryTime - now;
      if (diff <= 0) {
        setTimeLeft(0);
        onExpire();
        clearInterval(interval);
      } else {
        setTimeLeft(diff);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiryTime, onExpire]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  return (
    <div style={{ margin: '15px 0', padding: '15px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '12px' }}>
      <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fbbf24', fontFamily: 'monospace', lineHeight: '1' }}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
      <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '5px 0 0 0' }}>Internet Session Remaining</p>
    </div>
  );
};

// --- Terms Modal Component (Unchanged) ---
const TermsModal = ({ onClose }) => (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(5px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
  }}>
    <div style={{
      backgroundColor: '#1e293b', color: '#f8fafc', padding: '25px',
      borderRadius: '16px', maxWidth: '340px', width: '85%', maxHeight: '80vh', overflowY: 'auto', 
      border: '1px solid #334155', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
    }}>
      <h3 style={{ marginTop: 0, color: '#fbbf24', fontSize: '18px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>Terms of Service</h3>
      <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#cbd5e1', textAlign: 'left' }}>
        <p><strong>1. Acceptance:</strong> By connecting to the Shivaji University Network, you agree to comply with all university policies.</p>
        <p><strong>2. Prohibited Use:</strong> <ul style={{ paddingLeft: '15px', margin: '5px 0' }}><li>No hacking, sniffing, or port scanning.</li><li>No distributing malware or illegal content.</li><li>No bypassing authentication.</li></ul></p>
        <p><strong>3. Fair Use:</strong> No heavy bandwidth usage (mining, large P2P) during academic hours.</p>
        <p><strong>4. Monitoring:</strong> Logs and MAC addresses are recorded for security.</p>
      </div>
      <button onClick={onClose} style={{ marginTop: '15px', width: '100%', padding: '10px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>I Understand</button>
    </div>
  </div>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [cooldownMsg, setCooldownMsg] = useState('');

  // --- NEW: Ruckus State ---
  const [ruckusParams, setRuckusParams] = useState({ mac: '', sip: '' });
  const [guestPass, setGuestPass] = useState(null);
  const [expiryTime, setExpiryTime] = useState(null);

  // --- PERSISTENCE & URL PARSING ---
  useEffect(() => {
    // 1. Parse URL Params (Ruckus Redirect)
    const params = new URLSearchParams(window.location.search);
    const mac = params.get('client_mac') || params.get('mac');
    const sip = params.get('sip') || params.get('nbiIP') || params.get('uip'); // Fallbacks for Controller IP
    
    if (mac) {
      setRuckusParams({ mac, sip });
    }

    // 2. Check Local Storage
    const storedUser = localStorage.getItem('wifi_user');
    const storedIsAdmin = localStorage.getItem('wifi_is_admin');
    const storedExpiry = localStorage.getItem('wifi_expiry'); // Check for timer
    
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAdmin(storedIsAdmin === 'true');
    }

    if (storedExpiry) {
      const exp = parseInt(storedExpiry, 10);
      if (exp > Date.now()) {
        setExpiryTime(exp);
      } else {
        localStorage.removeItem('wifi_expiry'); // Clean up if expired
      }
    }
  }, []);

  const handleSuccess = async (cred) => {
    setCooldownMsg(''); 
    try {
      // 1. Verify Token (Pass MAC to server to generate Guest Pass)
      const response = await verifyGoogleToken(cred.credential, ruckusParams.mac);
      const verifiedUser = response.user;
      const passKey = response.guestPass; // Get the generated pass
      
      // 2. CHECK COOLDOWN & LIMITS
      const cooldownStatus = await checkLoginCooldown(verifiedUser.email);
      if (!cooldownStatus.allowed) {
        setCooldownMsg(cooldownStatus.message || `Login blocked. Try again later.`);
        return; 
      }

      // 3. Sync to DB
      await syncUserToDB(verifiedUser);

      // 4. Check if Admin
      const adminStatus = await checkAdminStatus(verifiedUser.email);
      setIsAdmin(adminStatus);
      setUser(verifiedUser);

      // 5. Handle Ruckus Session (If not admin)
      if (passKey) {
        setGuestPass(passKey); // Triggers auto-submit form
        const newExpiry = Date.now() + (10 * 60 * 1000); // 10 Minutes
        setExpiryTime(newExpiry);
        localStorage.setItem('wifi_expiry', String(newExpiry));
      }

      // 6. Save to LocalStorage
      localStorage.setItem('wifi_user', JSON.stringify(verifiedUser));
      localStorage.setItem('wifi_is_admin', adminStatus);

    } catch (e) {
      console.error("Something went wrong:", e);
      alert("Connection failed! Please try again.");
    }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('wifi_user');
    localStorage.removeItem('wifi_is_admin');
    localStorage.removeItem('wifi_expiry'); // Clear timer
    
    setUser(null);
    setIsAdmin(false);
    setTermsAccepted(false);
    setCooldownMsg('');
    setExpiryTime(null);
    setGuestPass(null);
  }

  // --- NEW: Auto-Submit Form to Ruckus ---
  useEffect(() => {
    if (guestPass && ruckusParams.sip) {
      // Small delay to ensure render, then submit
      setTimeout(() => {
        const form = document.getElementById('ruckus-login-form');
        if (form) form.submit();
      }, 500);
    }
  }, [guestPass, ruckusParams.sip]);

  if (user && isAdmin) {
    return <AdminDashboard user={user} onLogout={handleLogout} />;
  }

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      {/* --- NEW: Hidden Ruckus Form --- */}
      {guestPass && ruckusParams.sip && (
         <form id="ruckus-login-form" method="POST" action={`http://${ruckusParams.sip}:9997/login`} style={{ display: 'none' }}>
           <input type="hidden" name="username" value={guestPass} />
           <input type="hidden" name="password" value={guestPass} />
           {ruckusParams.mac && <input type="hidden" name="client_mac" value={ruckusParams.mac} />}
         </form>
      )}

      <style>{`
        body { margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; background-color: #020617; }
        .main-container { display: flex; height: 100vh; width: 100vw; overflow: hidden; background: #020617; color: #f8fafc; }
        .hero-section { flex: 1.2; background: radial-gradient(circle at top left, #1e293b, #020617); position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; border-right: 1px solid #1e293b; }
        .hero-glow { position: absolute; width: 500px; height: 500px; background: radial-gradient(circle, rgba(56,189,248,0.1) 0%, rgba(0,0,0,0) 70%); top: -100px; left: -100px; z-index: 0; pointer-events: none; }
        .login-section { flex: 0.8; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0f172a; position: relative; z-index: 10; }
        .login-card { width: 80%; max-width: 300px; padding: 2.5rem; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(148, 163, 184, 0.1); border-radius: 24px; backdrop-filter: blur(12px); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); text-align: center; transition: all 0.3s ease; }
        .link-text { color: #94a3b8; text-decoration: none; border-bottom: 1px dashed #64748b; transition: color 0.2s; cursor: pointer; }
        .link-text:hover { color: #fbbf24; border-color: #fbbf24; }
        input[type="checkbox"] { accent-color: #2563eb; transform: scale(1.2); cursor: pointer; }
        h1 { font-weight: 800; letter-spacing: -1px; }
        h2 { font-weight: 700; color: #f1f5f9; }
        p { color: #94a3b8; line-height: 1.6; }
        .mobile-header { display: none; }
        .error-msg { background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; padding: 10px; border-radius: 8px; font-size: 13px; margin-bottom: 15px; }
        @media (max-width: 768px) {
          .hero-section { display: none; }
          .login-section { flex: 1; width: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background: radial-gradient(circle at center, #1e293b 0%, #020617 100%); padding: 20px; box-sizing: border-box; }
          .mobile-header { display: block; text-align: center; width: 100%; margin-bottom: 30px; animation: fadeIn 0.8s ease-out; }
          .mobile-header h3 { font-size: 26px; margin: 0 0 5px 0; color: #f8fafc; font-weight: 800; }
          .mobile-header h4 { font-size: 16px; margin: 0 0 15px 0; color: #fbbf24; font-weight: 500; }
          .mobile-header p { font-size: 13px; color: #94a3b8; max-width: 320px; margin: 0 auto; line-height: 1.5; }
          .login-card { box-shadow: none; background: rgba(30, 41, 59, 0.61); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(10px); padding: 2rem 1.5rem; width: 90%; max-width: 360px; margin: 0; border-radius: 20px; }
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

      <div className="main-container">
        {/* Left Side: Desktop Hero */}
        <div className="hero-section">
          <div className="hero-glow"></div>
          <div style={{ zIndex: 1, maxWidth: '600px', textAlign: 'center' }}>
            <div style={{ marginBottom: '2rem', display: 'inline-block', padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' }}>
               <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="M9 12l2 2 4-4"></path> 
              </svg>
            </div>
            <h1 style={{ fontSize: '3.5rem', margin: '0 0 1rem 0', background: 'linear-gradient(to right, #f8fafc, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Shivaji University</h1>
            <h2 style={{ fontSize: '1.5rem', color: '#fbbf24', marginTop: '0', fontWeight: '500' }}>Kolhapur</h2>
            <div style={{ width: '60px', height: '4px', background: '#fbbf24', margin: '2rem auto', borderRadius: '2px' }}></div>
            <p style={{ fontSize: '1.2rem', maxWidth: '80%', margin: '0 auto' }}>Welcome to the campus network. Secure, high-speed connectivity for students and faculty & Guests.</p>
          </div>
        </div>

        {/* Right Side: Login Interaction */}
        <div className="login-section">
          <div className="mobile-header">
             <h3>Shivaji University</h3>
             <h4>Kolhapur</h4>
             <p>Welcome to the campus network. Secure, high-speed connectivity for students and faculty.</p>
          </div>

          <div className="login-card">
            {!user ? (
              <>
                <div style={{ marginBottom: '25px' }}>
                   <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                   </div>
                   <h2 style={{ fontSize: '22px', marginBottom: '5px' }}>Wi-Fi Login</h2>
                   <p style={{ fontSize: '13px' }}>Sign in to continue</p>
                </div>

                {cooldownMsg && <div className="error-msg">{cooldownMsg}</div>}
                
                {/* Warning if not connected to Ruckus (No Mac Address) */}
                {!ruckusParams.mac && (
                   <div className="error-msg" style={{ borderColor: 'rgba(251, 191, 36, 0.4)', background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                     ⚠️ Connect to Campus Wi-Fi to Login
                   </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', gap: '10px' }}>
                  <input type="checkbox" id="terms-check" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
                  <label htmlFor="terms-check" style={{ fontSize: '13px', color: '#cbd5e1', cursor: 'pointer' }}>I accept the <span onClick={(e) => { e.preventDefault(); setShowTerms(true); }} className="link-text" style={{ marginLeft: '4px' }}>Terms of Service</span></label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '25px', width: 'fit-content', margin: '0 auto 25px auto', border: '1px solid rgba(255, 255, 255, 0.4)', borderRadius: '24px', padding: '2px', background: '#000', opacity: termsAccepted ? 1 : 0.5, pointerEvents: termsAccepted ? 'auto' : 'none', filter: termsAccepted ? 'none' : 'grayscale(100%)', transition: 'all 0.3s ease' }}>
                  <GoogleLogin onSuccess={handleSuccess} onError={() => alert('Login Failed')} theme="filled_black" shape="pill" size="large" width="280" />
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                  <p style={{ fontSize: '11px', color: '#475569' }}><br/>Shivaji University, Kolhapur</p>
                </div>
              </>
            ) : (
              <>
                {/* --- LOGGED IN VIEW --- */}
                <div style={{ marginBottom: '20px', position: 'relative', display: 'inline-block' }}>
                  <img src={user.picture} alt="User" style={{ width: '90px', height: '90px', borderRadius: '50%', border: '3px solid #10b981', boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)' }} />
                  <div style={{ position: 'absolute', bottom: '0', right: '0', background: '#10b981', borderRadius: '50%', padding: '6px', border: '3px solid #0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                </div>
                <h2 style={{ margin: '10px 0 5px 0' }}>Welcome, {user.name}</h2>

                {/* --- TIMER SECTION (Replacing static badge) --- */}
                {expiryTime ? (
                  <>
                    <AccessTimer expiryTime={expiryTime} onExpire={() => setExpiryTime(null)} />
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '5px 15px', borderRadius: '50px', display: 'inline-block', marginBottom: '10px' }}>
                       <span style={{ color: '#34d399', fontWeight: '600', fontSize: '13px' }}>● Internet Active</span>
                    </div>
                  </>
                ) : (
                   <div style={{ margin: '20px 0', padding: '15px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px' }}>
                      <p style={{ color: '#fca5a5', fontSize: '0.9rem', margin: 0 }}>Session Expired</p>
                   </div>
                )}

                <p style={{ fontSize: '14px' }}>Device MAC Authenticated.<br/>You can now browse safely.</p>
                <button onClick={handleLogout} style={{ marginTop: '20px', padding: '8px 20px', fontSize: '12px', background: 'transparent', border: '1px solid #475569', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
              </>
            )}
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}