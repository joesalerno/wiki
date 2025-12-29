import React, { useState, useEffect } from 'react';
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

function PageViewer({ page, onEdit, onHistory, canEdit, pendingRevisions, onApprove, onReject, isApprover }) {
  if (!page) return <div>Page not found</div>;

  const { title, currentRevision } = page;

  return (
    <div className="wiki-article">
      <div className="wiki-content-area">
        <div className="wiki-header">
           <h1 className="wiki-header-title">{title}</h1>
           <div className="wiki-header-actions">
              <button className="btn btn-minimal" onClick={onHistory} title="View History">
                 <span style={{fontSize: '1.2rem', marginRight: '0.25rem'}}>↺</span> History
              </button>
              {canEdit && (
                <button className="btn btn-sm btn-primary" onClick={onEdit}>Edit Page</button>
              )}
           </div>
        </div>

        {pendingRevisions && pendingRevisions.length > 0 && (
            <div style={{marginBottom: '1.5rem', border: '1px solid #f59e0b', backgroundColor: '#fffbeb', borderRadius: '0.5rem', padding: '1rem'}}>
               <h3 style={{fontSize: '1rem', color: '#92400e', marginTop: 0}}>⚠️ Pending Revisions</h3>
               <p style={{fontSize: '0.9rem', color: '#b45309'}}>
                  There are {pendingRevisions.length} changes waiting for approval.
               </p>
               {isApprover ? (
                   <ul style={{listStyle: 'none', padding: 0, margin: '0.5rem 0 0'}}>
                       {pendingRevisions.map((rev, idx) => (
                           <li key={idx} style={{backgroundColor: 'white', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '0.25rem', border: '1px solid #e5e7eb'}}>
                               <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem'}}>
                                   <div style={{fontSize: '0.85rem'}}>
                                       <strong>{rev.authorId}</strong> proposed changes on {new Date(rev.timestamp).toLocaleString()}
                                   </div>
                                   <div>
                                       <button className="btn btn-sm btn-primary" style={{marginRight: '0.5rem', backgroundColor: '#10b981', borderColor: '#059669'}} onClick={() => onApprove(idx)}>Approve</button>
                                       <button className="btn btn-sm btn-secondary" style={{color: '#dc2626', borderColor: '#fca5a5'}} onClick={() => onReject(idx)}>Reject</button>
                                   </div>
                               </div>
                               <div style={{maxHeight: '200px', overflow: 'auto', border: '1px solid #eee', fontSize: '0.8rem', padding: '0.5rem', backgroundColor: '#f9fafb'}}>
                                   {computeDiff(currentRevision ? currentRevision.content : "", rev.content).map((line, k) => (
                                     <div key={k} style={{
                                       backgroundColor: line.type === 'added' ? '#dcfce7' : line.type === 'removed' ? '#fee2e2' : 'transparent',
                                       color: line.type === 'removed' ? '#991b1b' : line.type === 'added' ? '#166534' : 'inherit',
                                       whiteSpace: 'pre-wrap', fontFamily: 'monospace'
                                     }}>
                                       {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
                                       {line.text}
                                     </div>
                                   ))}
                               </div>
                           </li>
                       ))}
                   </ul>
               ) : (
                   <div style={{fontSize: '0.8rem', fontStyle: 'italic', color: '#b45309'}}>You do not have permission to approve these changes.</div>
               )}
            </div>
        )}

        <div style={{color: '#6b7280', fontSize: '0.85rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
          {currentRevision && (
            <>
              <span style={{backgroundColor: '#e5e7eb', color: '#374151', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem'}}>
                v{currentRevision.version}
              </span>
              <span>Updated {new Date(currentRevision.timestamp).toLocaleDateString()} by {currentRevision.authorId}</span>
            </>
          )}
          {!currentRevision && <span>No published content.</span>}
        </div>

        <div className="wiki-body">
          {currentRevision ? parseMarkdown(currentRevision.content) : <p>This page has no content yet.</p>}
        </div>
      </div>
    </div>
  );
}

function PageEditor({ page, initialTitle, initialContent, initialSectionId, sections, onSave, onCancel }) {
  const [title, setTitle] = useState(initialTitle || '');
  const [content, setContent] = useState(initialContent || '');
  const [sectionId, setSectionId] = useState(initialSectionId || (Object.keys(sections)[0]));
  const [activeTab, setActiveTab] = useState('write'); // 'write' or 'preview'

  return (
    <div className="wiki-editor-container">
      <div className="wiki-content-area" style={{display: 'flex', flexDirection: 'column', height: '100%'}}>

        <div className="wiki-header">
           {/* If creating a new page, title is editable, otherwise static header */}
           {!page ? (
             <h1 className="wiki-header-title">New Page</h1>
           ) : (
             <h1 className="wiki-header-title">Editing {page.title}</h1>
           )}

           <div className="wiki-header-actions">
              <button className="btn btn-sm btn-secondary" onClick={onCancel}>Cancel</button>
              <button className="btn btn-sm btn-primary" onClick={() => onSave(title, content, sectionId)}>Save Changes</button>
           </div>
        </div>

        <div className="wiki-editor-meta" style={{display: 'flex', gap: '1rem'}}>
          <input
            type="text"
            className="wiki-input-text"
            style={{flex: 2}}
            placeholder="Page Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={!!page}
          />
          <select
             className="wiki-input-text"
             style={{flex: 1}}
             value={sectionId}
             onChange={e => setSectionId(e.target.value)}
          >
             {Object.values(sections).map(s => (
                 <option key={s.id} value={s.id}>{s.title}</option>
             ))}
          </select>
        </div>

        <div style={{borderBottom: '1px solid #e5e7eb', marginBottom: '1rem', display: 'flex', gap: '1rem'}}>
          <button
            onClick={() => setActiveTab('write')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'write' ? '2px solid #2563eb' : '2px solid transparent',
              fontWeight: activeTab === 'write' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Write
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'preview' ? '2px solid #2563eb' : '2px solid transparent',
              fontWeight: activeTab === 'preview' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Preview
          </button>
        </div>

        {activeTab === 'write' ? (
          <textarea
            className="wiki-editor-input"
            placeholder="Write your content here... (Supports Markdown: #, *, -)"
            value={content}
            onChange={e => setContent(e.target.value)}
          />
        ) : (
          <div className="wiki-article" style={{flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem'}}>
             {parseMarkdown(content)}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Simple Diff Utility ---
const computeDiff = (oldText, newText) => {
  if (!oldText) oldText = "";
  if (!newText) newText = "";

  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // Very naive line-by-line diff for demonstration
  // Real diff algos are complex, this just shows what lines match roughly or creates a visual output
  const output = [];
  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      output.push({ type: 'same', text: oldLines[i] });
      i++;
      j++;
    } else if (j < newLines.length && (i >= oldLines.length || !oldLines.includes(newLines[j]))) {
       // New line added
       output.push({ type: 'added', text: newLines[j] });
       j++;
    } else if (i < oldLines.length) {
       // Old line removed
       output.push({ type: 'removed', text: oldLines[i] });
       i++;
    }
  }
  return output;
};

function PageHistory({ page, onBack, onRevert, canRevert }) {
  const [revisions, setRevisions] = useState([]);
  const [expandedView, setExpandedView] = useState({ version: null, mode: null }); // mode: 'diff' | 'full'

  useEffect(() => {
    if (page) {
      db.getHistory(page.slug).then(setRevisions);
    }
  }, [page]);

  if (!page) return null;

  const handleToggleDiff = (version) => {
    if (expandedView.version === version && expandedView.mode === 'diff') {
      setExpandedView({ version: null, mode: null });
    } else {
      setExpandedView({ version, mode: 'diff' });
    }
  };

  const handleToggleFull = (version) => {
    if (expandedView.version === version && expandedView.mode === 'full') {
      setExpandedView({ version: null, mode: null });
    } else {
      setExpandedView({ version, mode: 'full' });
    }
  };

  return (
     <div className="wiki-article">
      <div className="wiki-content-area">
        <div className="wiki-header">
           <h1 className="wiki-header-title">History: {page.title}</h1>
           <div className="wiki-header-actions">
             <button className="btn btn-sm btn-secondary" onClick={onBack}>Back to Page</button>
           </div>
        </div>

        <ul className="wiki-history-list">
          {revisions.map((rev, index) => {
             // Find previous revision to diff against
             const prevRev = revisions[index + 1];
             const isDiffOpen = expandedView.version === rev.version && expandedView.mode === 'diff';
             const isFullOpen = expandedView.version === rev.version && expandedView.mode === 'full';

             return (
              <React.Fragment key={rev.version}>
                <li className="history-item" style={{flexDirection: 'column', alignItems: 'stretch'}}>
                   <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
                     <div className="history-meta">
                       <span className="history-version">Version {rev.version}</span>
                       <span className="history-author">
                         Edited by {rev.authorId} on {new Date(rev.timestamp).toLocaleString()}
                       </span>
                     </div>
                     <div className="history-actions">
                       <button
                         className="btn btn-secondary"
                         style={{fontSize: '0.8rem', marginRight: '0.5rem'}}
                         onClick={() => handleToggleDiff(rev.version)}
                       >
                         {isDiffOpen ? 'Hide Changes' : 'Show Changes'}
                       </button>
                       <button
                         className="btn btn-secondary"
                         style={{fontSize: '0.8rem', marginRight: '0.5rem'}}
                         onClick={() => handleToggleFull(rev.version)}
                       >
                         {isFullOpen ? 'Hide Full' : 'Show Full'}
                       </button>

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
                   </div>

                   {isDiffOpen && (
                     <div style={{marginTop: '1rem', background: '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', fontSize: '0.9rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap'}}>
                        {computeDiff(prevRev ? prevRev.content : "", rev.content).map((line, k) => (
                          <div key={k} style={{
                            backgroundColor: line.type === 'added' ? '#dcfce7' : line.type === 'removed' ? '#fee2e2' : 'transparent',
                            color: line.type === 'removed' ? '#991b1b' : line.type === 'added' ? '#166534' : 'inherit',
                            padding: '0 0.25rem'
                          }}>
                            {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
                            {line.text}
                          </div>
                        ))}
                     </div>
                   )}

                   {isFullOpen && (
                     <div style={{marginTop: '1rem', background: '#fff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb'}}>
                        {parseMarkdown(rev.content)}
                     </div>
                   )}
                </li>
              </React.Fragment>
             );
          })}
        </ul>
      </div>
    </div>
  );
}

function Sidebar({ pages, sections, currentPageSlug, onSelectPage, onCreatePage, currentUser, users, onSwitchUser }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPages = pages.filter(page =>
    page.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group pages by section
  const pagesBySection = {};
  Object.values(sections).forEach(section => {
      // Check read permission
      const canRead = section.readGroups.some(g => currentUser?.groups.includes(g));
      if (canRead) {
          pagesBySection[section.id] = {
              title: section.title,
              pages: []
          };
      }
  });

  filteredPages.forEach(page => {
      // If page belongs to a section visible to user
      const secId = page.sectionId || 'general';
      if (pagesBySection[secId]) {
          pagesBySection[secId].pages.push(page);
      }
  });

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

      <input
        type="text"
        className="wiki-search-input"
        placeholder="Search pages..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
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

        <div className="wiki-nav-list">
          {Object.keys(pagesBySection).map(secId => (
            <div key={secId} style={{marginBottom: '1rem'}}>
               <div style={{fontSize: '0.8rem', fontWeight: 600, color: '#4b5563', padding: '0 0.5rem', marginBottom: '0.25rem'}}>
                   {pagesBySection[secId].title}
               </div>
               <ul>
                   {pagesBySection[secId].pages.map(page => (
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
                   {pagesBySection[secId].pages.length === 0 && (
                       <li style={{color: '#9ca3af', fontSize: '0.8rem', paddingLeft: '0.5rem'}}>Empty</li>
                   )}
               </ul>
            </div>
          ))}
          {Object.keys(pagesBySection).length === 0 && (
             <div style={{color: '#6b7280', fontSize: '0.9rem', fontStyle: 'italic', padding: '0.5rem'}}>No accessible sections</div>
          )}
        </div>
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
  const [sections, setSections] = useState({});
  const [currentPageSlug, setCurrentPageSlug] = useState('home');
  const [currentPageData, setCurrentPageData] = useState(null);
  const [viewMode, setViewMode] = useState('read'); // read, edit, history, new
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // Force update trigger

  // Load Initial Data
  useEffect(() => {
    const initData = async () => {
      await db.init();
      const [loadedUsers, loadedPages, loadedSections] = await Promise.all([
         db.getUsers(),
         db.getPages(),
         db.getSections()
      ]);
      setUsers(loadedUsers);

      let initialUser = currentUser;
      if (!initialUser) {
          const storedId = localStorage.getItem('wiki_user_id');
          if (storedId) initialUser = loadedUsers.find(u => u.id === storedId);
      }
      if (!initialUser) initialUser = loadedUsers[0];

      if (initialUser && (!currentUser || currentUser.id !== initialUser.id)) {
          setCurrentUser(initialUser);
          localStorage.setItem('wiki_user_id', initialUser.id);
      }

      setPages(loadedPages);
      setSections(loadedSections);
      setLoading(false);
    };
    initData();
  }, [tick]); // Reload all data on tick

  // Update Current Page Data when dependencies change
  useEffect(() => {
    const loadPage = async () => {
      if (currentPageSlug) {
          const page = await db.getPage(currentPageSlug);
          setCurrentPageData(page);
      } else {
          setCurrentPageData(null);
      }
    };
    loadPage();
  }, [currentPageSlug, tick]);

  const handleSwitchUser = (userId) => {
    const user = users.find(u => u.id === userId);
    if (user) {
        setCurrentUser(user);
        localStorage.setItem('wiki_user_id', userId);
        setTick(t => t + 1); // Refresh data with new user permissions
    }
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
  // Logic: Check section permissions for current page.
  const currentSection = currentPageData ? sections[currentPageData.sectionId] : null;
  const canEdit = currentUser && currentSection
      ? currentSection.writeGroups.some(g => currentUser.groups.includes(g))
      : false; // If new page, we check in save/create logic, but button shouldn't show if no page.

  // For delete/revert, we restrict to admin for now, or match server logic
  const canDelete = currentUser && currentUser.groups.includes('admin');

  if (loading) return <div className="wiki-container">Loading...</div>;

  return (
    <div className="wiki-container">
      <Sidebar
        pages={pages}
        sections={sections}
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
            pendingRevisions={currentPageData.pendingRevisions}
            isApprover={currentUser && sections[currentPageData.sectionId]?.approverGroups.some(g => currentUser.groups.includes(g))}
            onApprove={async (index) => {
               if(window.confirm("Approve this revision?")) {
                  try {
                      await db.approveRevision(currentPageData.slug, index, currentUser);
                      setTick(t => t + 1);
                  } catch(e) { alert(e.message); }
               }
            }}
            onReject={async (index) => {
               if(window.confirm("Reject this revision?")) {
                   try {
                       await db.rejectRevision(currentPageData.slug, index, currentUser);
                       setTick(t => t + 1);
                   } catch(e) { alert(e.message); }
               }
            }}
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
            initialSectionId={currentPageData.sectionId}
            sections={sections}
            onCancel={() => setViewMode('read')}
            onSave={async (title, content, sectionId) => {
              try {
                const res = await db.savePage(currentPageData.slug, title, content, currentUser, sectionId);
                if (res.status === 'pending') {
                    alert("Changes submitted for review.");
                }
                setTick(t => t + 1); // Trigger data refresh
                setViewMode('read');
              } catch (e) {
                alert(e.message);
              }
            }}
          />
        )}

        {viewMode === 'new' && (
          <PageEditor
            page={null}
            initialTitle=""
            initialContent=""
            initialSectionId={null}
            sections={sections}
            onCancel={() => setViewMode('read')}
            onSave={async (title, content, sectionId) => {
              const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              if (!slug) return alert("Please enter a valid title");
              const exists = await db.getPage(slug);
              if (exists) return alert("Page already exists");

              try {
                const res = await db.savePage(slug, title, content, currentUser, sectionId);
                 if (res.status === 'pending') {
                    alert("Page submitted for review.");
                    // Go to home or stay?
                }
                setCurrentPageSlug(slug);
                setTick(t => t + 1);
                setViewMode('read');
              } catch (e) {
                 alert(e.message);
              }
            }}
          />
        )}

        {viewMode === 'history' && currentPageData && (
          <PageHistory
            page={currentPageData}
            onBack={() => setViewMode('read')}
            canRevert={canDelete}
            onRevert={async (version) => {
               if(window.confirm(`Are you sure you want to revert to version ${version}?`)) {
                 await db.revert(currentPageData.slug, version, currentUser);
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
