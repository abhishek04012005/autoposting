import { useState, useEffect } from 'react';
import axios from 'axios';
import CreatePost from './CreatePost';
import './Dashboard.css';

/* Platform icon map — simple inline SVGs, no extra deps */
const PLATFORM_META = {
  facebook:  { color: '#1877f2', icon: 'f' },
  instagram: { color: '#e1306c', icon: '✦' },
  linkedin:  { color: '#0a66c2', icon: 'in' },
  pinterest: { color: '#e60023', icon: '📌' },
  youtube:   { color: '#ff0000', icon: '▶' },
};

function Dashboard({ token, onLogout }) {
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    // Fetch connected accounts
    axios.get('http://localhost:5000/api/social/accounts', {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: true,
    })
      .then(res => setAccounts(res.data))
      .catch(err => {
        console.error('Failed to fetch accounts:', err);
        // If token is invalid, logout user
        if (err.response?.status === 400 || err.response?.status === 401) {
          onLogout();
        }
      });
  }, [token, onLogout]);

  const connectPlatform = async (platform) => {
    console.log(`Connecting ${platform}...`);
    try {
      const res = await axios.get(`http://localhost:5000/api/social/connect/${platform}`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      console.log('Redirecting to:', res.data.url);
      window.location.href = res.data.url;
    } catch (err) {
      console.error('Failed to connect:', err);
      alert('Failed to connect: ' + err.message);
    }
  };

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px' }}>
        <h2 className="dashboard-title">Your&nbsp;Dashboard</h2>
        <button
          onClick={onLogout}
          style={{
            padding: '8px 16px',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Logout
        </button>
      </div>

      {/* ── Connected Accounts ─────────────────────────────── */}
      <div className="accounts-section">
        <h3 className="section-title">Connected Accounts</h3>
        <div className="accounts-grid">
          {accounts.length > 0 ? (
            accounts.map(acc => {
              const meta = PLATFORM_META[acc.platform] ?? {};
              return (
                <div
                  key={acc.id}
                  className="account-card"
                  style={{ '--card-accent': meta.color ?? 'var(--accent)' }}
                >
                  <span className="account-icon" aria-hidden="true">
                    {meta.icon ?? '●'}
                  </span>
                  <div className="account-platform">
                    {acc.platform.charAt(0).toUpperCase() + acc.platform.slice(1)}
                  </div>
                  <span className="account-badge">Connected</span>
                </div>
              );
            })
          ) : (
            <div className="empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"/>
                <path d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101"/>
              </svg>
              <p>No accounts connected yet.</p>
              <p className="empty-sub">Connect a platform below to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Connect New Accounts ───────────────────────────── */}
      <div className="connect-section">
        <h3 className="section-title">Connect New Accounts</h3>
        <div className="connect-grid">
          {['facebook', 'instagram', 'linkedin', 'pinterest', 'youtube'].map(platform => (
            <button
              key={platform}
              className="connect-button"
              data-platform={platform}
              onClick={() => connectPlatform(platform)}
            >
              {platform.charAt(0).toUpperCase() + platform.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <CreatePost token={token} />
    </div>
  );
}

export default Dashboard;