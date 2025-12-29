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

function PageViewer({ page, onEdit, onHistory, canEdit }) {
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

        <div style={{color: '#6b7280', fontSize: '0.85rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
          <span style={{backgroundColor: '#e5e7eb', color: '#374151', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem'}}>
            v{currentRevision.version}
          </span>
          <span>Updated {new Date(currentRevision.timestamp).toLocaleDateString()} by {currentRevision.authorId}</span>
        </div>

        <div className="wiki-body">
          {parseMarkdown(currentRevision.content)}
        </div>
      </div>
    </div>
  );
}

function PageEditor({ page, initialTitle, initialContent, onSave, onCancel, sections, initialSectionId }) {
  const [title, setTitle] = useState(initialTitle || '');
  const [content, setContent] = useState(initialContent || '');
  const [activeTab, setActiveTab] = useState('write'); // 'write' or 'preview'
  // Use state initialization function or just prop directly if we don't need to sync on prop change except mount
  // But if page changes while mounted, we need to update.
  // The lint error is about direct set state. We can use a key on the component to reset state.
  const [sectionId, setSectionId] = useState(initialSectionId || (sections[0] ? sections[0].id : ''));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update local state if page prop changes (e.g. user selected different page)
  // Removed useEffect to avoid lint error and reliance on key prop in parent handles reset.

  const handleSave = async () => {
      setIsSubmitting(true);
      await onSave(title, content, sectionId);
      setIsSubmitting(false);
  }

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
              <button className="btn btn-sm btn-secondary" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
              <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
           </div>
        </div>

        <div className="wiki-editor-meta" style={{display: 'flex', gap: '1rem', flexDirection: 'column'}}>
          <input
            type="text"
            className="wiki-input-text"
            placeholder="Page Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={!!page}
          />

          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <label style={{fontSize: '0.9rem', color: '#374151'}}>Section:</label>
              <select
                  className="user-select"
                  style={{width: 'auto', flex: 1}}
                  value={sectionId}
                  onChange={e => setSectionId(e.target.value)}
              >
                  {sections.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </select>
          </div>
        </div>

        <div style={{borderBottom: '1px solid #e5e7eb', marginBottom: '1rem', display: 'flex', gap: '1rem', marginTop: '1rem'}}>
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

function Sidebar({ pages, sections, currentPageSlug, onSelectPage, onCreatePage, currentUser, users, onSwitchUser, canManage, onManageSections, onReviewQueue }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Group pages by section
  const pagesBySection = {};
  sections.forEach(s => { pagesBySection[s.id] = []; });
  pages.forEach(p => {
      if(pagesBySection[p.sectionId]) pagesBySection[p.sectionId].push(p);
      else if(!p.sectionId && pagesBySection['general']) pagesBySection['general'].push(p);
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

        <ul className="wiki-nav-list">
          {sections.map(section => {
              const sectionPages = pagesBySection[section.id] || [];
              const filteredPages = sectionPages.filter(page =>
                page.title.toLowerCase().includes(searchTerm.toLowerCase())
              );

              if (searchTerm && filteredPages.length === 0) return null;

              return (
                  <li key={section.id} style={{marginBottom: '1rem'}}>
                      <div style={{fontSize: '0.8rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.5rem', paddingLeft: '0.5rem'}}>
                          {section.name}
                      </div>
                      <ul style={{listStyle: 'none', padding: 0}}>
                          {filteredPages.map(page => (
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
                          {filteredPages.length === 0 && !searchTerm && (
                              <li style={{color: '#9ca3af', fontSize: '0.8rem', paddingLeft: '1rem', fontStyle: 'italic'}}>No pages</li>
                          )}
                      </ul>
                  </li>
              );
          })}
        </ul>

        <div style={{marginTop: 'auto', borderTop: '1px solid #e5e7eb', paddingTop: '1rem'}}>
             {canManage && (
                 <button className="btn btn-secondary" style={{width: '100%', marginBottom: '0.5rem'}} onClick={onManageSections}>
                     Manage Sections
                 </button>
             )}
             <button className="btn btn-secondary" style={{width: '100%'}} onClick={onReviewQueue}>
                 Review Queue
             </button>
        </div>
      </div>
    </aside>
  );
}

function SectionManager({ sections, onSave }) {
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({});

    const handleEdit = (section) => {
        setEditingId(section.id);
        setFormData({...section});
    }

    const handleCreate = () => {
        const newId = `new_${Date.now()}`;
        setEditingId(newId);
        setFormData({
            id: '',
            name: '',
            permissions: {
                admin: ['read', 'write', 'manage'],
                editor: ['read', 'write'],
                viewer: ['read']
            },
            requiresReview: false
        });
    }

    const handleSave = async () => {
        if (!formData.id || !formData.name) return alert("ID and Name are required");
        await onSave(formData);
        setEditingId(null);
    }

    const updatePermission = (role, type, checked) => {
        const perms = {...formData.permissions};
        if(!perms[role]) perms[role] = [];
        if(checked) {
            if(!perms[role].includes(type)) perms[role].push(type);
        } else {
            perms[role] = perms[role].filter(p => p !== type);
        }
        setFormData({...formData, permissions: perms});
    }

    if (editingId) {
        return (
            <div className="wiki-content-area">
                <h1 className="wiki-header-title">{formData.id.startsWith('new_') ? 'Create Section' : 'Edit Section'}</h1>
                <div style={{marginTop: '1rem', maxWidth: '600px'}}>
                    <div style={{marginBottom: '1rem'}}>
                        <label style={{display:'block', marginBottom:'0.5rem'}}>ID (Unique, slug)</label>
                        <input type="text" className="wiki-input-text" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} disabled={!editingId.startsWith('new_')} />
                    </div>
                    <div style={{marginBottom: '1rem'}}>
                        <label style={{display:'block', marginBottom:'0.5rem'}}>Name</label>
                        <input type="text" className="wiki-input-text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                     <div style={{marginBottom: '1rem'}}>
                        <label style={{display:'flex', alignItems:'center', gap: '0.5rem'}}>
                            <input type="checkbox" checked={formData.requiresReview || false} onChange={e => setFormData({...formData, requiresReview: e.target.checked})} />
                            Require Review for changes
                        </label>
                    </div>

                    <h3 style={{marginTop: '2rem'}}>Permissions</h3>
                    <div style={{background: '#f9fafb', padding: '1rem', borderRadius: '0.5rem'}}>
                        {['admin', 'editor', 'viewer'].map(role => (
                            <div key={role} style={{marginBottom: '1rem'}}>
                                <strong style={{textTransform: 'capitalize'}}>{role}</strong>
                                <div style={{display: 'flex', gap: '1rem', marginTop: '0.5rem'}}>
                                    <label><input type="checkbox" checked={formData.permissions?.[role]?.includes('read')} onChange={e => updatePermission(role, 'read', e.target.checked)} /> Read</label>
                                    <label><input type="checkbox" checked={formData.permissions?.[role]?.includes('write')} onChange={e => updatePermission(role, 'write', e.target.checked)} /> Write</label>
                                    <label><input type="checkbox" checked={formData.permissions?.[role]?.includes('manage')} onChange={e => updatePermission(role, 'manage', e.target.checked)} /> Manage</label>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{marginTop: '2rem', display: 'flex', gap: '1rem'}}>
                        <button className="btn btn-primary" onClick={handleSave}>Save Section</button>
                        <button className="btn btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="wiki-content-area">
             <div className="wiki-header">
                <h1 className="wiki-header-title">Section Management</h1>
                <button className="btn btn-primary" onClick={handleCreate}>Create Section</button>
            </div>
            <table style={{width: '100%', borderCollapse: 'collapse', marginTop: '1rem'}}>
                <thead>
                    <tr style={{textAlign: 'left', borderBottom: '2px solid #e5e7eb'}}>
                        <th style={{padding: '0.5rem'}}>ID</th>
                        <th style={{padding: '0.5rem'}}>Name</th>
                        <th style={{padding: '0.5rem'}}>Requires Review</th>
                        <th style={{padding: '0.5rem'}}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {sections.map(s => (
                        <tr key={s.id} style={{borderBottom: '1px solid #e5e7eb'}}>
                            <td style={{padding: '0.5rem'}}>{s.id}</td>
                            <td style={{padding: '0.5rem'}}>{s.name}</td>
                            <td style={{padding: '0.5rem'}}>{s.requiresReview ? 'Yes' : 'No'}</td>
                            <td style={{padding: '0.5rem'}}>
                                <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(s)}>Edit</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ReviewQueue({ user, onReviewAction }) {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        db.getPendingReviews().then(res => {
            setReviews(res);
            setLoading(false);
        });
    }, []);

    const handleAction = async (slug, id, action) => {
        if(action === 'approve') await db.approveRevision(slug, id, user);
        else await db.rejectRevision(slug, id, user);

        // Refresh
        const res = await db.getPendingReviews();
        setReviews(res);
        onReviewAction(); // Notify parent to refresh other data if needed
    }

    if(loading) return <div className="wiki-content-area">Loading...</div>

    return (
        <div className="wiki-content-area">
            <h1 className="wiki-header-title">Review Queue</h1>
             {reviews.length === 0 ? (
                 <p>No pending reviews.</p>
             ) : (
                 <ul className="wiki-history-list">
                     {reviews.map((item, i) => (
                         <li key={i} className="history-item" style={{flexDirection: 'column', alignItems: 'stretch'}}>
                             <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                 <div>
                                     <strong>{item.pageTitle}</strong> <span style={{color:'#6b7280'}}>({item.pageSlug})</span>
                                     <div style={{fontSize: '0.85rem', marginTop: '0.25rem'}}>
                                         Submitted by {item.revision.authorId} on {new Date(item.revision.timestamp).toLocaleString()}
                                     </div>
                                 </div>
                                 <div className="history-actions">
                                     <button className="btn btn-sm btn-primary" style={{backgroundColor: '#16a34a', borderColor: '#16a34a'}} onClick={() => handleAction(item.pageSlug, item.revision.id, 'approve')}>Approve</button>
                                     <button className="btn btn-sm btn-secondary" style={{color: '#dc2626', borderColor: '#dc2626'}} onClick={() => handleAction(item.pageSlug, item.revision.id, 'reject')}>Reject</button>
                                 </div>
                             </div>
                             <div style={{marginTop: '1rem', background: '#f9fafb', padding: '1rem', borderRadius: '0.5rem', maxHeight: '200px', overflowY: 'auto', border: '1px solid #e5e7eb'}}>
                                 <pre style={{fontSize: '0.8rem', whiteSpace: 'pre-wrap'}}>{item.revision.content}</pre>
                             </div>
                         </li>
                     ))}
                 </ul>
             )}
        </div>
    )
}

// --- Main Wiki Component ---

export default function Wiki() {
  // State
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [pages, setPages] = useState([]);
  const [sections, setSections] = useState([]);
  const [currentPageSlug, setCurrentPageSlug] = useState('home');
  const [currentPageData, setCurrentPageData] = useState(null);
  const [viewMode, setViewMode] = useState('read'); // read, edit, history, new, manage-sections, reviews
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // Force update trigger

  // Load Initial Data
  useEffect(() => {
    const initData = async () => {
      await db.init();
      const loadedUsers = await db.getUsers();
      setUsers(loadedUsers);
      setCurrentUser(loadedUsers[0]);
      const loadedPages = await db.getPages();
      setPages(loadedPages);
      const loadedSections = await db.getSections();
      setSections(loadedSections);
      setLoading(false);
    };
    initData();
  }, [tick]); // Reload all data on tick

  // Update Current Page Data when dependencies change
  useEffect(() => {
    const loadPage = async () => {
      if (currentPageSlug && viewMode !== 'manage-sections' && viewMode !== 'reviews') {
          const page = await db.getPage(currentPageSlug);
          setCurrentPageData(page);
      } else {
          setCurrentPageData(null);
      }
    };
    loadPage();
  }, [currentPageSlug, tick, viewMode]);

  const handleSwitchUser = (userId) => {
    const user = users.find(u => u.id === userId);
    if (user) setCurrentUser(user);
    // Reset view if permission lost? For now keep simple
  };

  const handleSelectPage = (slug) => {
    setCurrentPageSlug(slug);
    setViewMode('read');
  };

  const handleCreatePage = () => {
    setCurrentPageSlug(null);
    setViewMode('new');
  };

  // Check permissions
  const getUserPermissions = (sectionId) => {
      if(!currentUser) return [];
      const section = sections.find(s => s.id === sectionId);
      if(!section) return [];

      let perms = new Set();
      currentUser.groups.forEach(group => {
          if(section.permissions[group]) {
              section.permissions[group].forEach(p => perms.add(p));
          }
      });
      return Array.from(perms);
  };

  const canManageSections = currentUser && currentUser.groups.includes('admin'); // Only admins can manage sections structure

  // Page level permissions based on section
  const currentSectionId = currentPageData ? currentPageData.sectionId : 'general'; // default to general
  const currentPerms = getUserPermissions(currentSectionId);
  const canEdit = currentPerms.includes('write');
  const canDelete = currentPerms.includes('manage'); // Use manage as delete for now

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
        canManage={canManageSections}
        onManageSections={() => setViewMode('manage-sections')}
        onReviewQueue={() => setViewMode('reviews')}
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
            key={currentPageData.slug} // Reset component state when changing pages
            page={currentPageData}
            initialTitle={currentPageData.title}
            initialContent={currentPageData.currentRevision.content}
            sections={sections}
            initialSectionId={currentPageData.sectionId}
            onCancel={() => setViewMode('read')}
            onSave={async (title, content, sectionId) => {
              const res = await db.savePage(currentPageData.slug, title, content, currentUser, sectionId);
              if(res.status === 'pending') {
                  alert("Your changes have been submitted for review.");
              }
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
            sections={sections}
            onCancel={() => setViewMode('read')}
            onSave={async (title, content, sectionId) => {
              const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              if (!slug) return alert("Please enter a valid title");
              const exists = await db.getPage(slug);
              if (exists) return alert("Page already exists");

              await db.savePage(slug, title, content, currentUser, sectionId);
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

        {viewMode === 'manage-sections' && (
            <SectionManager
                sections={sections}
                onCancel={() => setViewMode('read')}
                onSave={async (section) => {
                    await db.saveSection(section);
                    setTick(t => t + 1);
                }}
            />
        )}

        {viewMode === 'reviews' && (
            <ReviewQueue
                user={currentUser}
                onReviewAction={() => setTick(t => t + 1)}
            />
        )}
      </main>
    </div>
  );
}
