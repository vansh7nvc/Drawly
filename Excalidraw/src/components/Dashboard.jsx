import React, { useEffect, useState, useCallback } from 'react';

const Dashboard = ({ userId, onOpenDrawing, onNewDrawing, onLogout }) => {
  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDrawings = useCallback(async () => {
    try {
      setLoading(true);
      const url = searchQuery 
        ? `http://localhost:5001/drawings/user/${userId}?search=${encodeURIComponent(searchQuery)}`
        : `http://localhost:5001/drawings/user/${userId}`;
        
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setDrawings(data);
      } else {
        setError('Failed to load drawings');
      }
    } catch (err) {
      console.error("Fetch drawings error:", err);
      setError('Connection to backend failed');
    } finally {
      setLoading(false);
    }
  }, [userId, searchQuery]);

  useEffect(() => {
    fetchDrawings();
  }, [fetchDrawings]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const diffDays = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    // RelativeTimeFormat requires an integer. If same day, we say 'today'
    if (diffDays === 0) return 'today';
    
    try {
      return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(diffDays, 'day');
    } catch {
      return date.toLocaleDateString();
    }
  };

  const handleRename = async (e, id, currentTitle) => {
    e.stopPropagation();
    const newTitle = prompt('Enter new title:', currentTitle);
    if (!newTitle || newTitle === currentTitle) return;

    try {
      const response = await fetch(`http://localhost:5001/drawings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      if (response.ok) fetchDrawings();
    } catch (err) {
      console.error("Rename error:", err);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this drawing?')) return;

    try {
      const response = await fetch(`http://localhost:5001/drawings/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) fetchDrawings();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  return (
    <div className="dashboard-overlay">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L3 22h4l2-5h6l2 5h4L12 2z"/><path d="M10 14h4"/></svg>
          <span>Antidraw</span>
        </div>
        
        <nav className="dashboard-nav">
          <button className="nav-item active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            All Drawings
          </button>
          <button className="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Shared with me
          </button>
          <button className="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Trash
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={onLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-left">
            <h1>My Drawings</h1>
            <div className="search-bar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input 
                type="text" 
                placeholder="Search drawings..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <button className="new-drawing-btn" onClick={onNewDrawing}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Drawing
          </button>
        </header>

        {loading ? (
          <div className="dashboard-loader">Loading your workspace...</div>
        ) : error ? (
          <div className="dashboard-error">{error}</div>
        ) : drawings.length === 0 ? (
          <div className="dashboard-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" width="64"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            <p>You don't have any drawings yet.</p>
            <button onClick={onNewDrawing}>Create your first sketch</button>
          </div>
        ) : (
          <div className="drawing-grid">
            {drawings.map(drawing => (
              <div key={drawing._id} className="drawing-card" onClick={() => onOpenDrawing(drawing._id)}>
                <div className="drawing-preview">
                   <svg viewBox="0 0 100 60" fill="none" stroke="currentColor" opacity="0.1"><path d="M10 10l80 40M10 50l80-40" strokeWidth="2"/></svg>
                   <div className="card-actions">
                     <button title="Rename" onClick={(e) => handleRename(e, drawing._id, drawing.title)}>
                       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                     </button>
                     <button title="Delete" onClick={(e) => handleDelete(e, drawing._id)} className="delete-action">
                       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                     </button>
                   </div>
                </div>
                <div className="drawing-info">
                  <h3>{drawing.title}</h3>
                  <span>Edited {formatDate(drawing.lastSaved)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
