import React, { useEffect, useState, useCallback } from 'react';
import { getAllUsers } from '../services/db';

const AdminDashboard = ({ user, onLogout }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch logs from Firebase
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      // Sort: Newest logs first
      const sortedData = data.sort((a, b) => {
        const dateA = a.lastLogin?.toDate ? a.lastLogin.toDate() : new Date(a.lastLogin || 0);
        const dateB = b.lastLogin?.toDate ? b.lastLogin.toDate() : new Date(b.lastLogin || 0);
        return dateB - dateA; 
      });
      setLogs(sortedData);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial Fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Helper: Calculate Status based on 10-minute session limit
  const getStatus = (timestamp) => {
    if (!timestamp) return { label: 'Unknown', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' };
    
    // Convert Firestore Timestamp to JS Date
    const loginDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    
    // Difference in minutes
    const diffMins = (now - loginDate) / 1000 / 60;
    
    if (diffMins < 10) {
      return { label: 'Active', color: '#34d399', bg: 'rgba(16, 185, 129, 0.1)' };
    } else {
      return { label: 'Inactive', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Processing...';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('en-US', { 
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch (e) {
      return 'Invalid Date';
    }
  };

  // Filter logs: Exclude current admin & match search term
  const filteredLogs = logs.filter(log => 
    log.email !== user.email && 
    ((log.name && log.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (log.email && log.email.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  return (
    <div className="dashboard-wrapper">
      <style>{`
        /* --- Base & Reset --- */
        * { box-sizing: border-box; }
        body { margin: 0; }
        
        .dashboard-wrapper { 
          min-height: 100vh; 
          width: 100%; 
          background-color: #0f172a; 
          color: #f8fafc; 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
          padding: 20px;
          display: flex;
          flex-direction: column;
        }
        
        .dashboard-container { 
          width: 100%; 
          margin: 0; 
          flex-grow: 1;
          display: flex;
          flex-direction: column;
        }
        
        /* --- Header Section --- */
        .header-section { 
          background: #1e293b; 
          border: 1px solid #334155; 
          border-radius: 12px; 
          padding: 20px; 
          margin-bottom: 20px; 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          gap: 20px; 
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); 
        }
        .header-title h1 { margin: 0; font-size: 1.5rem; color: #fbbf24; }
        .header-title p { margin: 4px 0 0 0; color: #94a3b8; font-size: 0.9rem; }
        
        .header-actions { display: flex; gap: 12px; align-items: center; }
        
        /* Search Bar */
        .search-container { position: relative; width: 300px; }
        .search-input { 
          width: 100%; 
          padding: 10px 10px 10px 36px; 
          background: #0f172a; 
          border: 1px solid #475569; 
          border-radius: 8px; 
          color: white; 
          font-size: 0.9rem; 
          outline: none; 
          transition: border-color 0.2s;
        }
        .search-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
        .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #64748b; pointer-events: none; }
        
        /* Buttons */
        .btn { 
          border: none; 
          padding: 10px 20px; 
          border-radius: 8px; 
          font-weight: 600; 
          font-size: 0.9rem; 
          cursor: pointer; 
          white-space: nowrap; 
          transition: background 0.2s; 
          display: flex; 
          align-items: center; 
          gap: 8px; 
        }
        .refresh-btn { background: #3b82f6; color: white; }
        .refresh-btn:hover { background: #2563eb; }
        .refresh-btn:disabled { background: #1e40af; cursor: not-allowed; opacity: 0.7; }
        
        .logout-btn { background: #dc2626; color: white; }
        .logout-btn:hover { background: #b91c1c; }
        
        /* --- Table Card --- */
        .table-card { 
          background: #1e293b; 
          border: 1px solid #334155; 
          border-radius: 12px; 
          overflow: hidden; 
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); 
          display: flex;
          flex-direction: column;
          flex-grow: 1; 
        }
        
        .table-scroll-wrapper { 
          width: 100%; 
          overflow-x: auto; 
          -webkit-overflow-scrolling: touch; 
        }
        
        table { width: 100%; border-collapse: collapse; min-width: 800px; }
        
        thead th { 
          background: #0f172a; 
          position: sticky; top: 0; z-index: 10; 
          text-align: left; padding: 16px; color: #94a3b8; 
          font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; 
          border-bottom: 2px solid #334155; white-space: nowrap;
        }
        
        td { 
          padding: 16px; border-bottom: 1px solid #334155; 
          color: #e2e8f0; font-size: 0.95rem; vertical-align: middle; white-space: nowrap; 
        }
        
        tr:hover { background: rgba(255, 255, 255, 0.03); }
        
        .user-info { display: flex; align-items: center; gap: 12px; }
        .avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #475569; }
        .avatar-placeholder { width: 40px; height: 40px; border-radius: 50%; background: #334155; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #94a3b8; font-size: 1.1rem; }
        
        .badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; border: 1px solid; }
        .badge-dot { width: 6px; height: 6px; background: currentColor; border-radius: 50%; margin-right: 6px; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        @media (max-width: 900px) {
          .dashboard-wrapper { padding: 10px; }
          .header-section { flex-direction: column; align-items: stretch; gap: 15px; padding: 15px; }
          .header-actions { flex-direction: column; width: 100%; }
          .search-container { width: 100%; max-width: 100%; }
          .btn { width: 100%; justify-content: center; }
        }
      `}</style>

      <div className="dashboard-container">
        <div className="header-section">
          <div className="header-title">
            <h1>Access Logs</h1>
            <p>Admin Control Panel</p>
          </div>
          <div className="header-actions">
            <div className="search-container">
              <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" className="search-input" placeholder="Search user or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            
            <button onClick={fetchData} className="btn refresh-btn" disabled={loading}>
              <svg className={loading ? "spin" : ""} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>

            <button onClick={onLogout} className="btn logout-btn">Logout</button>
          </div>
        </div>

        <div className="table-card">
          {loading && logs.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid #475569', borderTopColor: '#fbbf24', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '15px' }}></div>
              <p>Syncing Database...</p>
            </div>
          ) : (
            <div className="table-scroll-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>User</th>
                    <th style={{ width: '30%' }}>Email Address</th>
                    <th style={{ width: '15%' }}>Status</th>
                    <th style={{ width: '25%' }}>Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No matching records found.</td></tr>
                  ) : (
                    filteredLogs.map((log) => {
                      // Calculate Status
                      const status = getStatus(log.lastLogin);
                      
                      return (
                        <tr key={log.id}>
                          <td>
                            <div className="user-info">
                              {log.picture ? <img src={log.picture} alt="" className="avatar" /> : <div className="avatar-placeholder">{log.name ? log.name.charAt(0).toUpperCase() : '?'}</div>}
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>{log.name || 'Unknown'}</span>
                                {log.role === 'admin' && <span style={{fontSize: '0.7rem', color: '#fbbf24', fontWeight: 'bold'}}>ADMIN</span>}
                              </div>
                            </div>
                          </td>
                          <td style={{ color: '#cbd5e1' }}>{log.email}</td>
                          {/* STATUS BADGE */}
                          <td>
                            <div className="badge" style={{ backgroundColor: status.bg, color: status.color, borderColor: status.color }}>
                              <span className="badge-dot" style={{ backgroundColor: status.color }}></span>
                              {status.label}
                            </div>
                          </td>
                          <td style={{ fontFamily: 'monospace', color: '#fbbf24' }}>{formatDate(log.lastLogin)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;