import React from "react";
import "./LandingPage.css";

const LandingPage = ({ onStart }) => {
  return (
    <div className="landing-container fade-in">
      {/* Background elements */}
      <div className="landing-bg">
        <div className="bg-glow-1"></div>
        <div className="bg-glow-2"></div>
        <div className="bg-grid"></div>
      </div>

      <main className="landing-hero">
        <div className="hero-content">
          <div className="hero-badge">AI-Powered Creative Suite</div>
          <h1 className="hero-title">
            Imagine, Draw, <span className="gradient-text">Drawly.</span>
          </h1>
          <p className="hero-subtitle">
            The premium vector canvas designed for your boldest ideas. From pixel-perfect sketches to AI-generated masterpieces.
          </p>
          <div className="hero-actions">
            <button className="cta-button primary" onClick={onStart}>
              Start Drawing — It's Free
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20"><path d="M5 12h14m-7-7l7 7-7 7"/></svg>
            </button>
            <button className="cta-button secondary" onClick={() => window.open('https://github.com', '_blank')}>
              View on GitHub
            </button>
          </div>
        </div>

        <div className="hero-preview">
          <div className="preview-card">
            <div className="preview-toolbar">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
            <div className="preview-canvas-placeholder">
              {/* Abstract drawing preview */}
              <svg viewBox="0 0 400 300" className="abstract-svg">
                <rect x="50" y="50" width="100" height="60" rx="8" className="shape rect" />
                <circle cx="200" cy="150" r="40" className="shape circle" />
                <path d="M100 200 L250 100" className="shape line" />
                <path d="M300 200 L350 250" className="shape line arrow" />
              </svg>
            </div>
          </div>
        </div>
      </main>

      <section className="features-grid">
        <div className="feature-card">
          <div className="feature-icon ai-icon">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </div>
          <h3>AI Design Gen</h3>
          <p>Describe your idea, and let Gemini bring it to life on your canvas in seconds.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon flow-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <h3>Mermaid Flow</h3>
          <p>Instantly convert Mermaid code into visual diagrams and flowcharts.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon dark-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </div>
          <h3>Modern Theme</h3>
          <p>Sleek, eye-pleasing dark mode support with a concise, draggable toolbar.</p>
        </div>
      </section>

      <footer className="landing-footer">
        <p>&copy; 2026 Drawly. Creative Freedom Redefined.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
