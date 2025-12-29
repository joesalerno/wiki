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

function PageViewer({ page, onEdit, onHistory, canEdit, sections, currentUser, onApprove, onReject }) {
  const [reviewMode, setReviewMode] = useState(false);

  if (!page) return <div>Page not found</div>;

  const { title, currentRevision, pendingRevisions, sectionId } = page;
  const section = sections[sectionId];

  // Check if user is approver
  const isApprover = currentUser && section && section.approverGroups.some(g => currentUser.groups.includes(g));

  const pendingRev = pendingRevisions && pendingRevisions[0]; // Just showing first for now

  return (
    <div className="wiki-article">
      <div className="wiki-content-area">
        {/* Pending Changes Banner */}
        {pendingRev && (
            <div style={{
                backgroundColor: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1.5rem'
            }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div>
                        <strong style={{color: '#9a3412'}}>Pending Changes</strong>
                        <p style={{margin: '0.25rem 0', fontSize: '0.9rem', color: '#c2410c'}}>
                            There are changes waiting for approval.
                            {pendingRev.authorId ? ` Submitted by ${pendingRev.authorId}.` : ''}
                        </p>
                    </div>
                    {isApprover && (
                         <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => setReviewMode(!reviewMode)}
                         >
                             {reviewMode ? 'Hide Review' : 'Review Changes'}
                         </button>
                    )}
                </div>

                {reviewMode && isApprover && (
                    <div style={{marginTop: '1rem', borderTop: '1px solid #fed7aa', paddingTop: '1rem'}}>
                         <div style={{marginBottom: '1rem', maxHeight: '300px', overflowY: 'auto', background: '#fff', padding: '0.5rem', border: '1px solid #eee'}}>
                             {/* Show Diff */}
                             <div style={{fontFamily: 'monospace', fontSize: '0.85rem', whiteSpace: 'pre-wrap'}}>
                                {computeDiff(currentRevision ? currentRevision.content : "", pendingRev.content).map((line, k) => (
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
                         </div>
                         <div style={{display: 'flex', gap: '0.5rem'}}>
                             <button className="btn btn-sm btn-primary" onClick={() => onApprove(0)}>Approve & Publish</button>
                             <button className="btn btn-sm btn-secondary" style={{color: '#991b1b', borderColor: '#fee2e2'}} onClick={() => onReject(0)}>Reject</button>
                         </div>
                    </div>
                )}
            </div>
        )}

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

        {currentRevision ? (
            <>
                <div style={{color: '#6b7280', fontSize: '0.85rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  <span style={{backgroundColor: '#e5e7eb', color: '#374151', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem'}}>
                    v{currentRevision.version}
                  </span>
                  <span>Updated {new Date(currentRevision.timestamp).toLocaleDateString()} by {currentRevision.authorId}</span>
                  <span style={{marginLeft: 'auto', fontSize: '0.75rem', color: '#9ca3af', border: '1px solid #e5e7eb', padding: '0 0.4rem', borderRadius: '1rem'}}>
                      Section: {section ? section.title : sectionId}
                  </span>
                </div>

                <div className="wiki-body">
                  {parseMarkdown(currentRevision.content)}
                </div>
            </>
        ) : (
            <div style={{padding: '2rem', textAlign: 'center', color: '#6b7280', fontStyle: 'italic'}}>
                This page has no published content yet.
                {pendingRevisions && pendingRevisions.length > 0 && " (Pending initial review)"}
            </div>
        )}
      </div>
    </div>
  );
}

function PageEditor({ page, initialTitle, initialContent, initialSectionId, sections, onSave, onCancel }) {
  const [title, setTitle] = useState(initialTitle || '');
  const [content, setContent] = useState(initialContent || '');
  const [sectionId, setSectionId] = useState(initialSectionId || (Object.keys(sections)[0] || 'general'));
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
              {Object.values(sections).map(sec => (
                  <option key={sec.id} value={sec.id}>{sec.title}</option>
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

  // Group pages by section
  const pagesBySection = {};
  Object.values(sections).forEach(section => {
      // Check read permissions for section
      const canRead = section.readGroups.some(g => currentUser?.groups.includes(g));
      if (canRead) {
          pagesBySection[section.id] = {
              title: section.title,
              pages: []
          };
      }
  });

  // Assign pages to sections
  pages.forEach(page => {
      if (page.title.toLowerCase().includes(searchTerm.toLowerCase())) {
          // If page has a sectionId that we have access to
          const sectionId = page.sectionId || 'general';
          if (pagesBySection[sectionId]) {
              pagesBySection[sectionId].pages.push(page);
          }
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

      <div className="wiki-nav" style={{marginTop: '2rem'}}>
        <input
          type="text"
          className="wiki-search-input"
          placeholder="Search pages..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

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

        {Object.entries(pagesBySection).map(([sectionId, section]) => (
            <div key={sectionId} style={{marginBottom: '1.5rem'}}>
                <h3 style={{
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    color: '#6b7280',
                    marginBottom: '0.5rem',
                    fontWeight: 700,
                    paddingLeft: '0.75rem'
                }}>{section.title}</h3>
                <ul className="wiki-nav-list">
                  {section.pages.map(page => (
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
                  {section.pages.length === 0 && (
                     <li style={{color: '#9ca3af', fontSize: '0.8rem', fontStyle: 'italic', paddingLeft: '0.75rem'}}>Empty</li>
                  )}
                </ul>
            </div>
        ))}
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
      const loadedUsers = await db.getUsers();
      setUsers(loadedUsers);
      setCurrentUser(loadedUsers[0]);
      const loadedSections = await db.getSections();
      setSections(loadedSections);
      const loadedPages = await db.getPages();
      setPages(loadedPages);
      setLoading(false);
    };
    initData();
  }, [tick]); // Reload all data on tick

  // Update Current Page Data when dependencies change
  useEffect(() => {
    const loadPage = async () => {
      if (currentPageSlug) {
          // Pass current user ID to check read permissions
          const page = await db.getPageWithUser(currentPageSlug, currentUser ? currentUser.id : null);
          setCurrentPageData(page);
      } else {
          setCurrentPageData(null);
      }
    };
    loadPage();
  }, [currentPageSlug, tick, currentUser]); // Added currentUser dependency

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
  const currentSection = currentPageData ? sections[currentPageData.sectionId] : null;

  let canEdit = false;
  let canDelete = false;

  if (currentUser) {
      if (currentPageData && currentSection) {
          // Check section permissions
          canEdit = currentSection.writeGroups.some(g => currentUser.groups.includes(g));
      } else if (!currentPageData) {
          // New page? Check if they have write access to ANY section?
          // For now, let's assume they can create if they are editor/admin
           canEdit = currentUser.groups.includes('admin') || currentUser.groups.includes('editor');
      }
      canDelete = currentUser.groups.includes('admin'); // Only admins can delete/revert for now
  }

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
            sections={sections}
            currentUser={currentUser}
            onEdit={() => setViewMode('edit')}
            onHistory={() => setViewMode('history')}
            canEdit={canEdit}
            onApprove={async (index) => {
                try {
                    await db.approveRevision(currentPageData.slug, index, currentUser);
                    setTick(t => t + 1);
                } catch(err) {
                    alert(err.message);
                }
            }}
            onReject={async (index) => {
                if(window.confirm("Reject this change?")) {
                    try {
                        await db.rejectRevision(currentPageData.slug, index, currentUser);
                        setTick(t => t + 1);
                    } catch(err) {
                        alert(err.message);
                    }
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
                await db.savePage(currentPageData.slug, title, content, currentUser, sectionId);
                setTick(t => t + 1); // Trigger data refresh
                setViewMode('read');
              } catch (err) {
                  alert(err.message);
              }
            }}
          />
        )}

        {viewMode === 'new' && (
          <PageEditor
            page={null}
            initialTitle=""
            initialContent=""
            initialSectionId="general"
            sections={sections}
            onCancel={() => setViewMode('read')}
            onSave={async (title, content, sectionId) => {
              const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              if (!slug) return alert("Please enter a valid title");
              const exists = await db.getPageWithUser(slug, currentUser ? currentUser.id : null);
              if (exists) return alert("Page already exists");

              try {
                await db.savePage(slug, title, content, currentUser, sectionId);
                setCurrentPageSlug(slug);
                setTick(t => t + 1);
                setViewMode('read');
              } catch (err) {
                  alert(err.message);
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
