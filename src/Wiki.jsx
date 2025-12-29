import React, { useState, useEffect, useMemo } from 'react';
import { db } from './db';
import './Wiki.css';

// --- Markdown Parser (Minimal) ---

const parseMarkdown = (text) => {
  if (!text) return null;
  const lines = text.split('\n');

  return lines.map((line, i) => {
    // Headers
    if (line.startsWith('# ')) return <h1 key={i}>{line.substring(2)}</h1>;
    if (line.startsWith('## ')) return <h2 key={i}>{line.substring(3)}</h2>;
    if (line.startsWith('### ')) return <h3 key={i}>{line.substring(4)}</h3>;

    // Unordered List
    if (line.startsWith('* ') || line.startsWith('- ')) {
      return <li key={i} style={{listStylePosition: 'inside', marginLeft: '1rem'}}>{formatInline(line.substring(2))}</li>;
    }

    // Blockquote
    if (line.startsWith('> ')) return <blockquote key={i}>{formatInline(line.substring(2))}</blockquote>;

    // Empty line
    if (line.trim() === '') return <div key={i} style={{height: '1rem'}} />;

    // Paragraph
    return <p key={i}>{formatInline(line)}</p>;
  });
};

const formatInline = (text) => {
  // Very basic inline formatting: **bold**, *italic*
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

// --- Sub-components ---

function PageViewer({ page, onEdit, onHistory, canEdit }) {
  if (!page) return <div>Page not found</div>;

  const { title, currentRevision } = page;

  return (
    <div className="wiki-article">
      <div className="wiki-toolbar">
         <div className="wiki-breadcrumbs">
           Pages / <span style={{color: '#111827', fontWeight: 500}}>{title}</span>
         </div>
         <div className="wiki-actions">
            <button className="btn btn-secondary" onClick={onHistory}>History</button>
            {canEdit && (
              <button className="btn btn-primary" onClick={onEdit}>Edit Page</button>
            )}
         </div>
      </div>

      <div className="wiki-content-area">
        <h1>{title}</h1>
        <div style={{color: '#6b7280', fontSize: '0.9rem', marginBottom: '2rem'}}>
          Last updated by {currentRevision.authorId} on {new Date(currentRevision.timestamp).toLocaleString()}
        </div>
        <div className="wiki-body">
          {parseMarkdown(currentRevision.content)}
        </div>
      </div>
    </div>
  );
}

function PageEditor({ page, initialTitle, initialContent, onSave, onCancel }) {
  const [title, setTitle] = useState(initialTitle || '');
  const [content, setContent] = useState(initialContent || '');

  return (
    <div className="wiki-editor-container">
      <div className="wiki-toolbar">
         <div className="wiki-breadcrumbs">
           {page ? `Editing ${page.title}` : 'Creating New Page'}
         </div>
         <div className="wiki-actions">
            <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
            <button className="btn btn-primary" onClick={() => onSave(title, content)}>Save Changes</button>
         </div>
      </div>

      <div className="wiki-content-area" style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
        <div className="wiki-editor-meta">
          <input
            type="text"
            className="wiki-input-text"
            placeholder="Page Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={!!page}
          />
        </div>
        <textarea
          className="wiki-editor-input"
          placeholder="Write your content here... (Supports Markdown: #, *, -)"
          value={content}
          onChange={e => setContent(e.target.value)}
        />
      </div>
    </div>
  );
}

function PageHistory({ page, onBack, onRevert, canRevert }) {
  if (!page) return null;
  const revisions = db.getHistory(page.slug);

  return (
     <div className="wiki-article">
      <div className="wiki-toolbar">
         <div className="wiki-breadcrumbs">
           <span style={{cursor: 'pointer'}} onClick={onBack}>Pages / {page.title}</span> / History
         </div>
         <div className="wiki-actions">
            <button className="btn btn-secondary" onClick={onBack}>Back to Page</button>
         </div>
      </div>

      <div className="wiki-content-area">
        <h1>Revision History: {page.title}</h1>

        <ul className="wiki-history-list">
          {revisions.map((rev) => (
            <li key={rev.version} className="history-item">
               <div className="history-meta">
                 <span className="history-version">Version {rev.version}</span>
                 <span className="history-author">
                   Edited by {rev.authorId} on {new Date(rev.timestamp).toLocaleString()}
                 </span>
               </div>
               <div className="history-actions">
                 {canRevert && rev.version !== page.currentRevision.version && (
                   <button
                     className="btn btn-secondary"
                     style={{fontSize: '0.8rem'}}
                     onClick={() => onRevert(rev.version)}
                   >
                     Revert to this
                   </button>
                 )}
                 {rev.version === page.currentRevision.version && (
                   <span style={{fontSize: '0.8rem', color: 'green', fontWeight: 600, padding: '0.2rem 0.5rem'}}>Current</span>
                 )}
               </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Sidebar({ pages, currentPageSlug, onSelectPage, onCreatePage, currentUser, users, onSwitchUser }) {
  return (
    <aside className="wiki-sidebar">
      <div className="wiki-brand">
        <span>✨ ReactWiki</span>
      </div>

      <div className="user-panel">
        <label style={{display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem'}}>Signed in as</label>
        <select
          className="user-select"
          value={currentUser?.id || ''}
          onChange={(e) => onSwitchUser(e.target.value)}
        >
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <div style={{marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280'}}>
          Access: {currentUser?.groups.join(', ')}
        </div>
      </div>

      <div className="wiki-nav" style={{marginTop: '2rem'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
          <span style={{fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '0.05em'}}>Pages</span>
          <button
            onClick={onCreatePage}
            className="btn btn-secondary"
            style={{padding: '0.2rem 0.5rem', fontSize: '0.8rem'}}
            title="New Page"
          >
            +
          </button>
        </div>
        <ul className="wiki-nav-list">
          {pages.map(page => (
            <li key={page.slug} className="wiki-nav-item">
              <a
                href={`#${page.slug}`}
                onClick={(e) => { e.preventDefault(); onSelectPage(page.slug); }}
                className={`wiki-nav-link ${currentPageSlug === page.slug ? 'active' : ''}`}
              >
                {page.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

// --- Main Wiki Component ---

export default function Wiki() {
  // State
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [pages, setPages] = useState([]);
  const [currentPageSlug, setCurrentPageSlug] = useState('home');
  const [viewMode, setViewMode] = useState('read'); // read, edit, history, new
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // Force update trigger

  // Load Initial Data
  useEffect(() => {
    const initData = () => {
      db.init();
      const loadedUsers = db.getUsers();
      setUsers(loadedUsers);
      setCurrentUser(loadedUsers[0]);
      setPages(db.getPages());
      setLoading(false);
    };
    initData();
  }, []);

  // Derived state (replaces explicit state that caused lint error)
  const currentPageData = useMemo(() => {
    return currentPageSlug ? db.getPage(currentPageSlug) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageSlug, pages, tick]);

  const handleSwitchUser = (userId) => {
    const user = users.find(u => u.id === userId);
    if (user) setCurrentUser(user);
  };

  const handleSelectPage = (slug) => {
    setCurrentPageSlug(slug);
    setViewMode('read');
  };

  const handleCreatePage = () => {
    setCurrentPageSlug(null);
    setViewMode('new');
  };

  // Derived state for permissions
  const currentGroup = currentUser ? db.getGroups()[currentUser.groups[0]] : null;
  const canEdit = currentGroup?.permissions.includes('write');

  if (loading) return <div className="wiki-container">Loading...</div>;

  return (
    <div className="wiki-container">
      <Sidebar
        pages={pages}
        currentPageSlug={currentPageSlug}
        onSelectPage={handleSelectPage}
        onCreatePage={handleCreatePage}
        currentUser={currentUser}
        users={users}
        onSwitchUser={handleSwitchUser}
      />

      <main className="wiki-main">
        {viewMode === 'read' && currentPageData && (
          <PageViewer
            page={currentPageData}
            onEdit={() => setViewMode('edit')}
            onHistory={() => setViewMode('history')}
            canEdit={canEdit}
          />
        )}

        {viewMode === 'read' && !currentPageData && (
          <div className="empty-state">
             <h2>Select a page</h2>
             <p>Choose a page from the sidebar to start reading.</p>
          </div>
        )}

        {viewMode === 'edit' && currentPageData && (
          <PageEditor
            page={currentPageData}
            initialTitle={currentPageData.title}
            initialContent={currentPageData.currentRevision.content}
            onCancel={() => setViewMode('read')}
            onSave={(title, content) => {
              db.savePage(currentPageData.slug, title, content, currentUser);
              setPages(db.getPages()); // Refresh list
              setTick(t => t + 1); // Trigger data refresh
              setViewMode('read');
            }}
          />
        )}

        {viewMode === 'new' && (
          <PageEditor
            page={null}
            initialTitle=""
            initialContent=""
            onCancel={() => setViewMode('read')}
            onSave={(title, content) => {
              const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              if (!slug) return alert("Please enter a valid title");
              if (db.getPage(slug)) return alert("Page already exists");

              db.savePage(slug, title, content, currentUser);
              setPages(db.getPages());
              setCurrentPageSlug(slug);
              setTick(t => t + 1);
              setViewMode('read');
            }}
          />
        )}

        {viewMode === 'history' && currentPageData && (
          <PageHistory
            page={currentPageData}
            onBack={() => setViewMode('read')}
            canRevert={currentGroup?.permissions.includes('delete')}
            onRevert={(version) => {
               if(window.confirm(`Are you sure you want to revert to version ${version}?`)) {
                 db.revert(currentPageData.slug, version, currentUser);
                 setPages(db.getPages());
                 setTick(t => t + 1);
                 setViewMode('read');
               }
            }}
          />
        )}
      </main>
    </div>
  );
}
