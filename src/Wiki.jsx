import React, { useState, useEffect } from 'react';
import './Wiki.css';
import { db } from './db';
import MarkdownRenderer from './MarkdownRenderer';

const Wiki = () => {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [pages, setPages] = useState([]);
  const [currentSlug, setCurrentSlug] = useState('home');
  const [viewMode, setViewMode] = useState('view'); // 'view', 'edit', 'history'
  const [currentPageData, setCurrentPageData] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [isCreatingPage, setIsCreatingPage] = useState(false);

  // Editor State
  const [editContent, setEditContent] = useState('');

  // Load initial data
  useEffect(() => {
    const loadInitialData = () => {
      setUsers(db.getUsers());
      const initialUsers = db.getUsers();
      if (initialUsers.length > 0) {
        setCurrentUser(initialUsers[0]);
      }
      setPages(db.getPages());
    };
    loadInitialData();
  }, []);

  // Load page data when slug changes
  useEffect(() => {
    const loadPageData = () => {
        const page = db.getPage(currentSlug);
        if (page) {
            setCurrentPageData(page);
            setEditContent(page.revisions[0].content);
            setError(null);
        } else {
            setError('Page not found');
            setCurrentPageData(null);
        }
        setViewMode('view');
        setMessage(null);
    };
    loadPageData();
  }, [currentSlug]);

  const refreshPages = () => {
    setPages(db.getPages());
  };

  // Helper to check permissions
  const hasPermission = (action) => {
    if (!currentUser) return false;
    const userGroups = currentUser.groups;
    const allGroups = db.getGroups();

    return userGroups.some(groupName => {
        const group = allGroups[groupName];
        return group && group.permissions.includes(action);
    });
  };

  const handleCreatePage = (e) => {
      e.preventDefault();
      if (!newPageTitle.trim()) return;

      try {
          const newPage = db.createPage(newPageTitle, currentUser);
          refreshPages();
          setCurrentSlug(newPage.slug);
          setIsCreatingPage(false);
          setNewPageTitle('');
          setMessage('Page created successfully');
      } catch (err) {
          alert(err.message);
      }
  };

  const handleSave = () => {
      try {
          const updatedPage = db.savePage(currentSlug, editContent, currentUser);
          setCurrentPageData(updatedPage);
          setViewMode('view');
          setMessage('Page saved successfully');
          refreshPages(); // To update snippets or order if needed
      } catch (err) {
          alert('Failed to save: ' + err.message);
      }
  };

  const handleRevert = (version) => {
      if (!window.confirm(`Are you sure you want to revert to version ${version}? This will create a new version.`)) return;

      try {
          const updatedPage = db.revertTo(currentSlug, version, currentUser);
          setCurrentPageData(updatedPage);
          setEditContent(updatedPage.revisions[0].content);
          setViewMode('view');
          setMessage(`Reverted to version ${version}`);
      } catch (err) {
          alert('Failed to revert: ' + err.message);
      }
  };

  const parseInline = (text) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={i}>{part.slice(1, -1)}</em>;
        }
         if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={i} style={{backgroundColor: '#f4f4f5', padding: '0.2rem 0.4rem', borderRadius: '4px', fontFamily: 'monospace'}}>{part.slice(1, -1)}</code>;
        }
        return part;
    });
};

  return (
    <div className="wiki-container">
      {/* Sidebar */}
      <aside className="wiki-sidebar">
        <div className="wiki-header">
           <span>⚡ Wiki</span>
        </div>

        {hasPermission('write') && (
            isCreatingPage ? (
                <form onSubmit={handleCreatePage} style={{marginBottom: '1rem'}}>
                    <input
                        autoFocus
                        type="text"
                        placeholder="Page Title..."
                        className="user-select"
                        style={{marginBottom: '0.5rem'}}
                        value={newPageTitle}
                        onChange={(e) => setNewPageTitle(e.target.value)}
                    />
                    <div style={{display: 'flex', gap: '0.5rem'}}>
                        <button type="submit" className="btn btn-primary" style={{flex: 1, fontSize: '0.8rem'}}>Create</button>
                        <button type="button" className="btn" onClick={() => setIsCreatingPage(false)} style={{fontSize: '0.8rem'}}>Cancel</button>
                    </div>
                </form>
            ) : (
                <button className="new-page-btn" onClick={() => setIsCreatingPage(true)}>+ New Page</button>
            )
        )}

        <div className="wiki-nav">
            <ul className="wiki-nav-list">
                {pages.map(p => (
                    <li
                        key={p.slug}
                        className={`wiki-nav-item ${currentSlug === p.slug ? 'active' : ''}`}
                        onClick={() => setCurrentSlug(p.slug)}
                    >
                        {p.title}
                    </li>
                ))}
            </ul>
        </div>

        <div className="wiki-user-panel">
            <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)'}}>
                Current User:
            </label>
            <select
                className="user-select"
                value={currentUser ? currentUser.id : ''}
                onChange={(e) => setCurrentUser(users.find(u => u.id === e.target.value))}
            >
                {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.groups.join(', ')})</option>
                ))}
            </select>
        </div>
      </aside>

      {/* Main Content */}
      <main className="wiki-main">
          {/* Toolbar */}
          <div className="wiki-toolbar">
              <h1 className="page-title">{currentPageData ? currentPageData.title : 'Page Not Found'}</h1>
              <div className="toolbar-actions">
                  {viewMode !== 'view' && (
                       <button className="btn" onClick={() => setViewMode('view')}>View</button>
                  )}
                  {viewMode !== 'edit' && hasPermission('write') && (
                       <button className="btn" onClick={() => setViewMode('edit')}>Edit</button>
                  )}
                  {viewMode !== 'history' && (
                       <button className="btn" onClick={() => setViewMode('history')}>History</button>
                  )}
                  {viewMode === 'edit' && (
                       <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
                  )}
              </div>
          </div>

          {message && (
              <div style={{
                  padding: '0.5rem 2rem',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--success-color)',
                  fontSize: '0.9rem'
              }}>
                  {message}
              </div>
          )}

          {/* Content Area */}
          <div className="wiki-content-area">
             {viewMode === 'view' && currentPageData && (
                 <MarkdownRenderer content={currentPageData.revisions[0].content} parseInline={parseInline} />
             )}

             {viewMode === 'view' && !currentPageData && (
                 <p style={{color: 'var(--text-secondary)'}}>Select a page from the sidebar.</p>
             )}

             {viewMode === 'edit' && (
                 <textarea
                    className="wiki-editor"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="# Start writing..."
                 />
             )}

             {viewMode === 'history' && currentPageData && (
                 <ul className="history-list">
                     {currentPageData.revisions.map((rev) => (
                         <li key={rev.version} className="history-item">
                             <div className="history-meta">
                                 <span className="history-version">Version {rev.version}</span>
                                 <span className="history-author">
                                     by {users.find(u => u.id === rev.authorId)?.name || rev.authorId}
                                     {' • '}
                                     {new Date(rev.timestamp).toLocaleString()}
                                 </span>
                             </div>
                             {hasPermission('write') && rev.version !== currentPageData.revisions[0].version && (
                                 <button className="btn" style={{fontSize: '0.8rem'}} onClick={() => handleRevert(rev.version)}>
                                     Restore
                                 </button>
                             )}
                              {rev.version === currentPageData.revisions[0].version && (
                                 <span className="permission-badge">Current</span>
                             )}
                         </li>
                     ))}
                 </ul>
             )}
          </div>
      </main>
    </div>
  );
};

export default Wiki;
