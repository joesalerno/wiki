import React, { useState } from 'react';
import Login from './components/Login';
import PageList from './components/PageList';
import PageViewer from './components/PageViewer';
import PageEditor from './components/PageEditor';
import HistoryViewer from './components/HistoryViewer';
import './Wiki.css';

export default function Wiki() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('view'); // view, edit, history, create
  const [currentSlug, setCurrentSlug] = useState('welcome-to-wiki');
  const [editData, setEditData] = useState(null);
  const [historyVersion, setHistoryVersion] = useState(null); // For viewing old versions

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const handleNavigate = (slug) => {
    setCurrentSlug(slug);
    setView('view');
    setHistoryVersion(null);
  };

  const handleCreate = () => {
    setEditData(null);
    setView('create');
  };

  const handleEdit = (data) => {
    setEditData(data);
    setView('edit');
  };

  const handleHistory = () => {
    setView('history');
  };

  const handleViewVersion = (version) => {
      setHistoryVersion(version);
      setView('view');
  }

  const handleSave = (newSlug) => {
    if (newSlug) setCurrentSlug(newSlug);
    setView('view');
  };

  const handleLogout = () => {
      setUser(null);
      setView('view');
      setCurrentSlug('welcome-to-wiki');
  }

  return (
    <div className="wiki-container">
      <aside className="wiki-sidebar">
        <h2>MiniWiki</h2>
        <div style={{ marginBottom: '1rem' }}>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleCreate} disabled={!user.permissions.includes('write')}>
            + New Page
          </button>
        </div>
        <PageList onNavigate={handleNavigate} />

        <div className="user-info">
          <div>Logged in as: <strong>{user.username}</strong></div>
          <button onClick={handleLogout} style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'red', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Logout
          </button>
        </div>
      </aside>

      <main className="wiki-main">
        {view === 'view' && (
          <PageViewer
            slug={currentSlug}
            user={user}
            onEdit={handleEdit}
            onHistory={handleHistory}
            version={historyVersion}
          />
        )}
        {(view === 'edit' || view === 'create') && (
          <PageEditor
            slug={view === 'edit' ? currentSlug : undefined}
            initialData={editData}
            onSave={handleSave}
            onCancel={() => setView('view')}
            user={user}
          />
        )}
        {view === 'history' && (
          <HistoryViewer
            slug={currentSlug}
            currentVersion={99999} // Not used for now, logic inside component handles list
            onViewVersion={handleViewVersion}
            onBack={() => setView('view')}
          />
        )}
      </main>
    </div>
  );
}
