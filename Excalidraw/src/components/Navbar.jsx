import React from "react";
import "./Navbar.css";

const Navbar = ({ view, onNavigate, onShowLogin, user }) => {
  return (
    <nav className={`main-navbar ${view === 'landing' ? 'on-landing' : 'on-app'}`}>
      <div className="nav-left">
        <div className="brand" onClick={() => onNavigate('landing')}>
          <div className="brand-logo">
            <img src="/drawly-logo.png" alt="Drawly Logo" />
          </div>
          <span className="brand-name">Drawly</span>
        </div>
        
        {view === 'landing' && (
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#community">Community</a>
            <a href="#" className="badge">Beta</a>
          </div>
        )}
      </div>

      <div className="nav-right">
        {view === 'landing' ? (
          <>
            <button className="nav-btn text" onClick={onShowLogin}>Log In</button>
            <button className="nav-btn primary" onClick={() => onNavigate('app')}>Get Started</button>
          </>
        ) : (
          <>
            <div className="workspace-status">
              <span className="status-dot green"></span>
              Live Sync
            </div>
            {user ? (
              <div className="user-profile">
                <div className="avatar">{user.username?.[0]?.toUpperCase() || 'U'}</div>
                <span className="username">{user.username}</span>
              </div>
            ) : (
              <button className="nav-btn secondary sm" onClick={onShowLogin}>Sign In</button>
            )}
            <button className="settings-trigger">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
