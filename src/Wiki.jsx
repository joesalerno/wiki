import React, { useEffect, useRef, useState } from 'react';
import { wikiApi } from './wikiApi';
import { renderMarkdown } from './wikiMarkdown';
import './Wiki.css';

const ADMIN_GROUPS = new Set(['admin', 'wiki_admin']);
const ADMIN_PERMISSION_GROUP = 'wiki_admin';

function dedupeItems(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function withRequiredAdminPermission(groups) {
  return dedupeItems([
    ADMIN_PERMISSION_GROUP,
    ...(groups || []).map(groupName => ADMIN_GROUPS.has(groupName) ? ADMIN_PERMISSION_GROUP : groupName)
  ]);
}

function getAdminPermissionMemberNames(groups, users) {
  const memberIds = new Set(
    Object.values(groups || {})
      .filter(group => ADMIN_GROUPS.has(group.name))
      .flatMap(group => group.memberIds || [])
  );

  return users
    .filter(user => memberIds.has(user.id))
    .map(user => user.name);
}

function getUserGroups(groups, userId) {
  return Object.values(groups || {})
    .filter(group => (group.memberIds || []).includes(userId))
    .map(group => group.name);
}

function normalizeGroups(groups) {
  return Object.fromEntries(
    (groups || []).map(group => {
      const memberIds = (group.users || []).map(user => user.id);
      return [group.name, { ...group, memberIds }];
    })
  );
}

function hasGroupAccess(groupNames, user) {
  if (!groupNames || groupNames.length === 0) return true;
  if (!user) return false;
  const userGroups = new Set(user.groups || []);
  return (groupNames || []).some(groupName => userGroups.has(groupName));
}

function buildUsersWithGroups(users, groups) {
  return users.map(user => {
    const memberships = getUserGroups(groups, user.id);
    return {
      ...user,
      groups: memberships,
      isAdmin: memberships.some(groupName => ADMIN_GROUPS.has(groupName))
    };
  });
}

function formatList(items) {
  return items && items.length > 0 ? items.join(', ') : 'None';
}

function formatReadGroups(items) {
  return items && items.length > 0 ? items.join(', ') : 'Anyone';
}

function formatWriteGroups(items) {
  return items && items.length > 0 ? items.join(', ') : 'Anyone';
}

function formatApproverGroups(items) {
  return items && items.length > 0 ? items.join(', ') : 'Anyone';
}

function SelectionChips({ items, emptyLabel }) {
  if (!items || items.length === 0) {
    return <div className="wiki-picker-empty">{emptyLabel}</div>;
  }

  return (
    <div className="wiki-picker-chips">
      {items.map(item => (
        <span key={item} className="wiki-picker-chip">{item}</span>
      ))}
    </div>
  );
}

function FilterableChecklist({
  filterValue,
  onFilterChange,
  filterPlaceholder,
  options,
  selectedValues,
  onToggle,
  emptyResultsLabel,
  selectedSummaryLabel,
  emptySelectionLabel,
  height = 220
}) {
  return (
    <div className="wiki-picker">
      {typeof onFilterChange === 'function' && (
        <input
          type="text"
          className="wiki-search-input wiki-picker-filter"
          placeholder={filterPlaceholder}
          value={filterValue}
          onChange={e => onFilterChange(e.target.value)}
        />
      )}
      <div className="wiki-picker-list" style={{ maxHeight: `${height}px` }}>
        {options.length === 0 ? (
          <div className="wiki-picker-empty">{emptyResultsLabel}</div>
        ) : options.map(option => {
          const checked = selectedValues.includes(option.value);
          return (
            <label key={option.value} className={`wiki-picker-item ${checked ? 'selected' : ''} ${option.disabled ? 'disabled' : ''}`}>
              <input
                type="checkbox"
                checked={checked}
                disabled={option.disabled}
                onChange={() => !option.disabled && onToggle(option.value)}
              />
              <div className="wiki-picker-item-body">
                <div className="wiki-picker-item-title">{option.label}</div>
                {option.description && <div className="wiki-picker-item-description">{option.description}</div>}
              </div>
            </label>
          );
        })}
      </div>
      <div className="wiki-picker-summary-label">{selectedSummaryLabel}</div>
      <SelectionChips items={selectedValues} emptyLabel={emptySelectionLabel} />
    </div>
  );
}

// --- Sub-components ---

function PageViewer({ page, onEdit, onHistory, canEdit, pendingRevisions, onApprove, onReject, isApprover, currentUser }) {
  if (!page) return <div>Page not found</div>;

  const { title, currentRevision } = page;
  const currentSectionId = page.sectionId || 'Unassigned';

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
               <button title="Edit Page" className="btn btn-sm btn-primary" onClick={onEdit}>Edit Page</button>
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
                           (() => {
                             const targetSectionId = rev.sectionId || currentSectionId;
                             const sectionChanged = targetSectionId !== currentSectionId;

                             return (
                           <li key={idx} style={{backgroundColor: 'white', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '0.25rem', border: '1px solid #e5e7eb'}}>
                               <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem'}}>
                                   <div style={{fontSize: '0.85rem'}}>
                                       <strong>{rev.authorId}</strong> proposed changes on {new Date(rev.timestamp).toLocaleString()}
                                       {sectionChanged && (
                                         <div style={{marginTop: '0.35rem', fontSize: '0.8rem', color: '#92400e'}}>
                                           Section change: <strong>{currentSectionId}</strong> to <strong>{targetSectionId}</strong>
                                         </div>
                                       )}
                                   </div>
                                   <div>
                                       <button
                                          className="btn btn-sm btn-primary"
                                          style={{
                                              marginRight: '0.5rem',
                                              backgroundColor: currentUser?.id === rev.authorId ? '#9ca3af' : '#10b981',
                                              borderColor: currentUser?.id === rev.authorId ? '#9ca3af' : '#059669',
                                              cursor: currentUser?.id === rev.authorId ? 'not-allowed' : 'pointer'
                                          }}
                                          onClick={() => onApprove(idx)}
                                          disabled={currentUser?.id === rev.authorId}
                                          title={currentUser?.id === rev.authorId ? "Cannot approve own changes" : "Approve"}
                                       >
                                           Approve
                                       </button>
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
                               );
                               })()
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
          {currentRevision ? renderMarkdown(currentRevision.content) : <p>This page has no content yet.</p>}
        </div>
      </div>
    </div>
  );
}

function PageEditor({ page, initialTitle, initialContent, initialSectionId, sections, onSave, onCancel }) {
  const initialResolvedTitle = initialTitle || '';
  const initialResolvedContent = initialContent || '';
  const initialResolvedSectionId = initialSectionId || (sections[0]?.title || '');
  const [title, setTitle] = useState(initialTitle || '');
  const [content, setContent] = useState(initialContent || '');
  const [sectionId, setSectionId] = useState(initialSectionId || (sections[0]?.title || ''));
  const [activeTab, setActiveTab] = useState('write'); // 'write' or 'preview'
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const normalizedTitle = title.trim();
  const isExistingPage = Boolean(page);
  const hasAvailableSection = sections.length > 0;
  const hasChanges = title !== initialResolvedTitle
    || content !== initialResolvedContent
    || sectionId !== initialResolvedSectionId;
  const canSave = !isUploading && hasChanges && hasAvailableSection && (isExistingPage || normalizedTitle.length > 0);

  useEffect(() => {
    if (!sections.length) {
      if (sectionId !== '') setSectionId('');
      return;
    }

    const hasCurrentSection = sections.some(section => section.title === sectionId);
    if (!hasCurrentSection) {
      setSectionId(initialResolvedSectionId);
    }
  }, [initialResolvedSectionId, sectionId, sections]);

  const handleReset = () => {
    setTitle(initialResolvedTitle);
    setContent(initialResolvedContent);
    setSectionId(initialResolvedSectionId);
    setActiveTab('write');
  };

  const insertSnippet = (snippet, selectionOffset = snippet.length) => {
    const textarea = textareaRef.current;
    const start = textarea ? textarea.selectionStart : content.length;
    const end = textarea ? textarea.selectionEnd : content.length;
    const nextContent = `${content.slice(0, start)}${snippet}${content.slice(end)}`;

    setContent(nextContent);

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      const nextCursor = start + selectionOffset;
      textareaRef.current.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const wrapSelection = (prefix, suffix = prefix, placeholder = 'text') => {
    const textarea = textareaRef.current;
    const start = textarea ? textarea.selectionStart : content.length;
    const end = textarea ? textarea.selectionEnd : content.length;
    const selection = content.slice(start, end) || placeholder;
    const snippet = `${prefix}${selection}${suffix}`;
    const selectionOffset = prefix.length + selection.length + suffix.length;
    insertSnippet(snippet, selectionOffset);
  };

  const insertLineTemplate = (template) => {
    const textarea = textareaRef.current;
    const start = textarea ? textarea.selectionStart : content.length;
    const prefix = start > 0 && !content.slice(0, start).endsWith('\n') ? '\n' : '';
    const suffix = content.endsWith('\n') || !content ? '' : '\n';
    insertSnippet(`${prefix}${template}${suffix}`);
  };

  const handleUpload = async (event, kind) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setIsUploading(true);
      const asset = await wikiApi.uploadWikiAsset(file);
      const snippet = kind === 'image' && asset.isImage
        ? asset.markdown
        : asset.isImage && kind === 'file'
          ? `[${asset.fileName}](${asset.url})`
          : asset.markdown;
      insertLineTemplate(snippet);
      setActiveTab('write');
    } catch (error) {
      alert(error.message);
    } finally {
      setIsUploading(false);
    }
  };

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
              <button className="btn btn-sm btn-secondary" onClick={handleReset} disabled={!hasChanges || isUploading}>Reset</button>
              <button className="btn btn-sm btn-secondary" onClick={onCancel}>Cancel</button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => onSave(title, content, sectionId)}
                disabled={!canSave}
                title={
                  !hasAvailableSection
                    ? 'No writable sections available'
                    : !hasChanges
                      ? 'No changes to save'
                      : isUploading
                        ? 'Upload in progress'
                        : 'Save changes'
                }
              >
                Save Changes
              </button>
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
             disabled={!hasAvailableSection}
          >
             {sections.map(s => (
                <option key={s.title} value={s.title}>{s.title}</option>
             ))}
          </select>
        </div>

        {!hasAvailableSection && (
          <div className="wiki-inline-notice">
            You do not have a writable section available for this page.
          </div>
        )}

        <div style={{borderBottom: '1px solid #e5e7eb', marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center'}}>
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

        <div className="wiki-editor-toolbar">
          <button type="button" className="btn btn-secondary" onClick={() => wrapSelection('**', '**', 'bold text')}>Bold</button>
          <button type="button" className="btn btn-secondary" onClick={() => wrapSelection('*', '*', 'italic text')}>Italic</button>
          <button type="button" className="btn btn-secondary" onClick={() => wrapSelection('`', '`', 'inline code')}>Code</button>
          <button type="button" className="btn btn-secondary" onClick={() => insertLineTemplate('- List item')}>List</button>
          <button type="button" className="btn btn-secondary" onClick={() => insertLineTemplate('1. Ordered item')}>Numbered</button>
          <button type="button" className="btn btn-secondary" onClick={() => insertLineTemplate('> Quote')}>Quote</button>
          <button type="button" className="btn btn-secondary" onClick={() => insertLineTemplate('```\ncode\n```')}>Code Block</button>
          <button type="button" className="btn btn-secondary" onClick={() => insertSnippet('[link text](https://example.com)')}>Link</button>
          <button type="button" className="btn btn-secondary" onClick={() => imageInputRef.current?.click()} disabled={isUploading}>Image</button>
          <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>File</button>
        </div>

        <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => handleUpload(event, 'image')} />
        <input ref={fileInputRef} type="file" hidden onChange={(event) => handleUpload(event, 'file')} />

        {activeTab === 'write' ? (
          <textarea
            ref={textareaRef}
            className="wiki-editor-input"
            placeholder="Write your content here... Supports headings, links, images, lists, blockquotes, code, and fenced code blocks."
            value={content}
            onChange={e => setContent(e.target.value)}
          />
        ) : (
          <div className="wiki-article" style={{flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem'}}>
             {renderMarkdown(content)}
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
  const currentRevisionVersion = page?.currentRevision?.version ?? null;

  useEffect(() => {
    if (page) {
      wikiApi.getWikiPageHistory(page.title).then(setRevisions);
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

                       {canRevert && rev.version !== currentRevisionVersion && (
                         <button
                           className="btn btn-secondary"
                           style={{fontSize: '0.8rem'}}
                           onClick={() => onRevert(rev.version)}
                         >
                           Revert to this
                         </button>
                       )}
                       {rev.version === currentRevisionVersion && (
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
                        {renderMarkdown(rev.content)}
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

function AdminPanel({ users, groups, sections, onUpdate, onClose, currentUser }) {
  const [activeTab, setActiveTab] = useState('sections');
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [sectionFormData, setSectionFormData] = useState({});
  const [editingGroupName, setEditingGroupName] = useState(null);
  const [groupFormName, setGroupFormName] = useState('wiki_');
  const [groupMemberIds, setGroupMemberIds] = useState([]);
  const [groupFilter, setGroupFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [permissionGroupFilter, setPermissionGroupFilter] = useState('');
  const canManageSections = Boolean(currentUser?.isAdmin);
  const groupOptions = Object.values(groups).sort((left, right) => left.name.localeCompare(right.name));
  const editableGroupOptions = groupOptions.filter(group => group.name.startsWith('wiki_'));
  const filteredGroupOptions = editableGroupOptions.filter(group => group.name.toLowerCase().includes(groupFilter.toLowerCase()));
  const filteredSections = Object.values(sections)
    .sort((left, right) => left.title.localeCompare(right.title))
    .filter(section => section.title.toLowerCase().includes(sectionFilter.toLowerCase()));
  const filteredUsers = users.filter(user => user.name.toLowerCase().includes(userFilter.toLowerCase()));
  const filteredPermissionGroups = groupOptions.filter(group => group.name.toLowerCase().includes(permissionGroupFilter.toLowerCase()));
  const adminPermissionMembers = getAdminPermissionMemberNames(groups, users);
  const groupUserNames = Object.fromEntries(
    groupOptions.map(group => [
      group.name,
      (group.memberIds || [])
        .map(memberId => users.find(user => user.id === memberId)?.name || memberId)
        .join(', ')
    ])
  );
  const isEditingGroup = editingGroupName !== null;
  const isEditingSection = editingSectionId !== null;
  const isEditing = isEditingGroup || isEditingSection;

  const toggleSelectedValue = (values, value) => (
    values.includes(value)
      ? values.filter(entry => entry !== value)
      : [...values, value]
  );

  const groupChecklistOptions = filteredPermissionGroups.map(group => ({
    value: group.name,
    label: group.name,
    description: groupUserNames[group.name] || 'No members'
  }));

  const permissionChecklistOptions = [
    {
      value: ADMIN_PERMISSION_GROUP,
      label: ADMIN_PERMISSION_GROUP,
      description: adminPermissionMembers.length > 0 ? adminPermissionMembers.join(', ') : 'No members',
      disabled: true
    },
    ...groupChecklistOptions.filter(option => !ADMIN_GROUPS.has(option.value))
  ];

  const userChecklistOptions = filteredUsers.map(user => ({
    value: user.id,
    label: user.name,
    description: formatList(user.groups || [])
  }));

  const startEditSection = (title, data) => {
    if (!canManageSections) return;

    setActiveTab('sections');
    setEditingGroupName(null);
    setUserFilter('');
    setEditingSectionId(title);
    if (title === 'new') {
      setSectionFormData({
        title: '',
        readGroups: withRequiredAdminPermission([]),
        writeGroups: withRequiredAdminPermission([]),
        approverGroups: [],
        reviewRequired: false
      });
      setPermissionGroupFilter('');
      return;
    }

    setPermissionGroupFilter('');
    setSectionFormData({
      ...data,
      readGroups: withRequiredAdminPermission(data?.readGroups || []),
      writeGroups: withRequiredAdminPermission(data?.writeGroups || []),
      approverGroups: data?.reviewRequired ? withRequiredAdminPermission(data?.approverGroups || []) : [],
      reviewRequired: Boolean(data?.reviewRequired)
    });
  };

  const startEditGroup = (name, data) => {
    if (!canManageSections) return;
    if (name !== 'new' && !name.startsWith('wiki_')) return;

    setActiveTab('groups');
    setEditingSectionId(null);
    setPermissionGroupFilter('');
    setEditingGroupName(name);
    if (name === 'new') {
      setGroupFormName('wiki_');
      setGroupMemberIds([]);
      setUserFilter('');
      return;
    }

    setUserFilter('');
    setGroupFormName(data?.name || name);
    setGroupMemberIds(data?.memberIds || []);
  };

  const stopEditing = () => {
    setEditingSectionId(null);
    setEditingGroupName(null);
    setPermissionGroupFilter('');
    setUserFilter('');
  };

  const handleSaveSection = async () => {
    try {
      if (editingSectionId === 'new') {
        await wikiApi.createWikiSection(sectionFormData);
      } else {
        await wikiApi.updateWikiSection(editingSectionId, sectionFormData);
      }

      onUpdate();
      stopEditing();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeleteSection = async (title) => {
    if (!window.confirm('Are you sure?')) return;

    try {
      await wikiApi.deleteWikiSection(title);
      onUpdate();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSaveGroup = async () => {
    try {
      const trimmedName = groupFormName.trim();
      const normalizedName = trimmedName.startsWith('wiki_') ? trimmedName : `wiki_${trimmedName.replace(/^wiki_/, '')}`;
      if (editingGroupName === 'new') {
        await wikiApi.createWikiGroup(normalizedName);
      }
      await wikiApi.updateWikiGroup(normalizedName, groupMemberIds);
      onUpdate();
      stopEditing();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeleteGroup = async (name) => {
    if (name === ADMIN_PERMISSION_GROUP) {
      alert('wiki_admin cannot be deleted.');
      return;
    }

    if (!window.confirm(`Delete ${name}?`)) return;

    try {
      await wikiApi.deleteWikiGroup(name);
      onUpdate();
    } catch (error) {
      alert(error.message);
    }
  };

  const renderSectionForm = () => (
    <div className="admin-form">
      <div className="wiki-admin-editor-header">
        <div>
          <h2 className="wiki-admin-editor-title">{editingSectionId === 'new' ? 'New Section' : `Editing ${editingSectionId}`}</h2>
          <div className="wiki-admin-editor-subtitle">Configure section access by group. Leave empty to allow anyone with access to perform the action.</div>
        </div>
      </div>

      <div className="wiki-admin-field">
        <label className="wiki-admin-label">Section Name</label>
        <input
          type="text"
          placeholder="Section name"
          value={sectionFormData.title || ''}
          onChange={e => setSectionFormData({ ...sectionFormData, title: e.target.value })}
        />
      </div>

      <div className="wiki-admin-field">
        <label className="wiki-admin-label">Filter Available Groups</label>
        <input
          type="text"
          className="wiki-search-input wiki-picker-filter"
          placeholder="Search groups by name"
          value={permissionGroupFilter}
          onChange={e => setPermissionGroupFilter(e.target.value)}
        />
      </div>

      <div className="wiki-admin-field" style={{ marginTop: '0.25rem' }}>
        <label>
          <input
            type="checkbox"
            checked={sectionFormData.reviewRequired || false}
            onChange={e => setSectionFormData({
              ...sectionFormData,
              reviewRequired: e.target.checked,
              approverGroups: e.target.checked ? withRequiredAdminPermission(sectionFormData.approverGroups || []) : []
            })}
          />
          Review Required
        </label>
      </div>

      <div className="wiki-admin-picker-grid">
        <div className="wiki-admin-field">
          <label className="wiki-admin-label">Read Groups</label>
          <FilterableChecklist
            options={permissionChecklistOptions}
            selectedValues={withRequiredAdminPermission(sectionFormData.readGroups || [])}
            onToggle={(value) => setSectionFormData({
              ...sectionFormData,
              readGroups: withRequiredAdminPermission(toggleSelectedValue(sectionFormData.readGroups || [], value))
            })}
            emptyResultsLabel="No groups match this filter."
            selectedSummaryLabel="Selected read groups"
            emptySelectionLabel="wiki_admin is always included"
            height={150}
          />
        </div>

        <div className="wiki-admin-field">
          <label className="wiki-admin-label">Write Groups</label>
          <FilterableChecklist
            options={permissionChecklistOptions}
            selectedValues={withRequiredAdminPermission(sectionFormData.writeGroups || [])}
            onToggle={(value) => setSectionFormData({
              ...sectionFormData,
              writeGroups: withRequiredAdminPermission(toggleSelectedValue(sectionFormData.writeGroups || [], value))
            })}
            emptyResultsLabel="No groups match this filter."
            selectedSummaryLabel="Selected write groups"
            emptySelectionLabel="wiki_admin is always included"
            height={150}
          />
        </div>

        {sectionFormData.reviewRequired && (
          <div className="wiki-admin-field">
            <label className="wiki-admin-label">Approver Groups</label>
            <FilterableChecklist
              options={permissionChecklistOptions}
              selectedValues={withRequiredAdminPermission(sectionFormData.approverGroups || [])}
              onToggle={(value) => setSectionFormData({
                ...sectionFormData,
                approverGroups: withRequiredAdminPermission(toggleSelectedValue(sectionFormData.approverGroups || [], value))
              })}
              emptyResultsLabel="No groups match this filter."
              selectedSummaryLabel="Selected approver groups"
              emptySelectionLabel="wiki_admin is always included"
              height={150}
            />
          </div>
        )}
      </div>

      <div className="admin-actions" style={{ marginTop: '1rem' }}>
        <button className="btn btn-sm btn-primary" onClick={handleSaveSection}>Save</button>
        <button className="btn btn-sm btn-secondary" onClick={stopEditing}>Close Section Editor</button>
      </div>
    </div>
  );

  const renderGroupForm = () => (
    <div className="admin-form" style={{ marginBottom: '1.5rem' }}>
      <div className="wiki-admin-editor-header">
        <div>
          <h2 className="wiki-admin-editor-title">{editingGroupName === 'new' ? 'New Group' : `Editing ${editingGroupName}`}</h2>
          <div className="wiki-admin-editor-subtitle">Create or update a wiki group and manage its members in one place.</div>
        </div>
      </div>

      <div className="wiki-admin-field">
        <label className="wiki-admin-label">Group Name</label>
        {editingGroupName === 'new' ? (
          <div className="wiki-prefixed-input">
            <span className="wiki-prefixed-input-prefix">wiki_</span>
            <input
              type="text"
              placeholder="group_name"
              value={groupFormName.replace(/^wiki_/, '')}
              onChange={e => setGroupFormName(`wiki_${e.target.value.replace(/^wiki_/, '')}`)}
            />
          </div>
        ) : (
          <input
            type="text"
            value={groupFormName}
            disabled
            readOnly
          />
        )}
      </div>

      <div className="wiki-admin-field">
        <label className="wiki-admin-label">Filter Users</label>
        <input
          type="text"
          className="wiki-search-input wiki-picker-filter"
          placeholder="Search users by name"
          value={userFilter}
          onChange={e => setUserFilter(e.target.value)}
        />
      </div>

      <div className="wiki-admin-field">
        <label className="wiki-admin-label">Members</label>
      <FilterableChecklist
        options={userChecklistOptions}
        selectedValues={groupMemberIds}
        onToggle={(value) => setGroupMemberIds(toggleSelectedValue(groupMemberIds, value))}
        emptyResultsLabel="No users match this filter."
        selectedSummaryLabel="Selected members"
        emptySelectionLabel="No members selected"
        height={220}
      />
      </div>

      <div className="admin-actions" style={{ marginTop: '1rem' }}>
        <button className="btn btn-sm btn-primary" onClick={handleSaveGroup}>Save</button>
        <button className="btn btn-sm btn-secondary" onClick={stopEditing}>Close Group Editor</button>
      </div>
    </div>
  );

  return (
    <div className="wiki-article">
      <div className="wiki-content-area">
        <div className="wiki-header">
          <h1 className="wiki-header-title">Section Management</h1>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>Close</button>
        </div>

        {!canManageSections && (
          <div className="wiki-inline-notice">
            Only admin or wiki_admin members can manage groups and sections.
          </div>
        )}

        {isEditing && (
          <div className="wiki-inline-notice" style={{ background: '#f9fafb', color: '#374151', borderColor: '#e5e7eb' }}>
            You can edit one thing at a time. Finish or close the current editor before opening another.
          </div>
        )}

        <div className="wiki-admin-tabs" role="tablist" aria-label="Management tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sections'}
            className={`wiki-admin-tab ${activeTab === 'sections' ? 'active' : ''}`}
            onClick={() => !isEditing && setActiveTab('sections')}
            disabled={isEditing && !isEditingSection}
          >
            Sections
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'groups'}
            className={`wiki-admin-tab ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => !isEditing && setActiveTab('groups')}
            disabled={isEditing && !isEditingGroup}
          >
            Groups
          </button>
        </div>

        {isEditingGroup && renderGroupForm()}
        {isEditingSection && renderSectionForm()}

        {!isEditing && activeTab === 'groups' && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <button className="btn btn-sm btn-primary" onClick={() => startEditGroup('new', {})} disabled={!canManageSections}>
              + Create Wiki Group
            </button>
            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Only wiki_ groups can be created or edited here. Section permissions can still use any backend group.
            </div>
          </div>

          <input
            type="text"
            placeholder="Filter groups"
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            style={{ marginBottom: '1rem', maxWidth: '320px' }}
          />

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.5rem' }}>Group</th>
                <th style={{ padding: '0.5rem' }}>Members</th>
                <th style={{ padding: '0.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroupOptions.map(group => (
                <tr key={group.name} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.5rem' }}>{group.name}</td>
                  <td style={{ padding: '0.5rem' }}>{groupUserNames[group.name] || 'No members'}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <button className="btn-text" onClick={() => startEditGroup(group.name, group)} disabled={!canManageSections}>Edit Members</button>
                    {group.name === ADMIN_PERMISSION_GROUP ? (
                      <span style={{ color: '#9ca3af', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                        Protected
                      </span>
                    ) : (
                      <button
                        className="btn-text"
                        style={{ color: '#9ca3af', marginLeft: '0.5rem', cursor: canManageSections ? 'pointer' : 'not-allowed' }}
                        onClick={() => canManageSections && handleDeleteGroup(group.name)}
                        disabled={!canManageSections}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredGroupOptions.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ padding: '0.75rem 0.5rem', color: '#6b7280', fontStyle: 'italic' }}>
                    No editable wiki_ groups found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}

        {!isEditing && activeTab === 'sections' && (
        <div>
           <div style={{marginBottom: '1rem'}}>
            <button className="btn btn-sm btn-primary" onClick={() => startEditSection('new', {})} disabled={!canManageSections}>
              + Create New Section
            </button>
           </div>

          <input
            type="text"
            placeholder="Filter sections"
            value={sectionFilter}
            onChange={e => setSectionFilter(e.target.value)}
            style={{ marginBottom: '1rem', maxWidth: '320px' }}
          />

          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem'}}>
            <thead>
              <tr style={{textAlign: 'left', borderBottom: '1px solid #e5e7eb'}}>
                <th style={{padding: '0.5rem'}}>Title</th>
                <th style={{padding: '0.5rem'}}>Details</th>
                <th style={{padding: '0.5rem'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
               {filteredSections.map(s => (
                <tr key={s.title} style={{borderBottom: '1px solid #f3f4f6'}}>
                  <td style={{padding: '0.5rem'}}>{s.title}</td>
                  <td style={{padding: '0.5rem'}}>
                    <div><strong>{s.title}</strong></div>
                    <div style={{fontSize: '0.8rem'}}>
                      <span style={{color: '#059669'}}>R: {formatReadGroups(s.readGroups)}</span> |
                      <span style={{color: '#d97706'}}> W: {formatWriteGroups(s.writeGroups)}</span>
                    </div>
                    {s.reviewRequired && <div style={{fontSize: '0.75rem', color: '#dc2626'}}>Review Required (Approvers: {formatApproverGroups(s.approverGroups)})</div>}
                  </td>
                  <td style={{padding: '0.5rem'}}>
                    <button className="btn-text" onClick={() => startEditSection(s.title, s)} disabled={!canManageSections}>Edit Section</button>
                    <button
                      className="btn-text"
                      style={{color: '#9ca3af', marginLeft: '0.5rem', cursor: canManageSections ? 'pointer' : 'not-allowed'}}
                      onClick={() => canManageSections && handleDeleteSection(s.title)}
                      disabled={!canManageSections}
                      title={canManageSections ? 'Delete Section' : "You don't have permission to delete sections"}
                    >
                      Delete
                    </button>
                    {!canManageSections && (
                      <div style={{fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem'}}>
                      You don't have permission to delete sections.
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredSections.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ padding: '0.75rem 0.5rem', color: '#6b7280', fontStyle: 'italic' }}>
                    No sections match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}

function Sidebar({ pages, sections, currentPageTitle, onSelectPage, onCreatePage, currentUser, users, onSwitchUser, onOpenAdmin, canCreatePage, canManageSections }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPages = pages.filter(page =>
    page.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group pages by section
  const pagesBySection = {};
    Object.values(sections).forEach(section => {
      const canRead = hasGroupAccess(section.readGroups, currentUser);
      if (canRead) {
        pagesBySection[section.title] = {
          title: section.title,
          pages: []
        };
      }
    });

    const defaultSectionTitle = Object.keys(sections)[0];
    filteredPages.forEach(page => {
      // If page belongs to a section visible to user
      const secTitle = page.sectionId || defaultSectionTitle;
      if (pagesBySection[secTitle]) {
        pagesBySection[secTitle].pages.push(page);
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
        <div style={{marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span>Role: {currentUser?.isAdmin ? 'Admin' : 'Member'}</span>
        </div>
        <div style={{marginTop: '0.25rem', fontSize: '0.75rem', color: '#9ca3af'}}>
          Groups: {formatList(currentUser?.groups || [])}
        </div>
      </div>

      <div className="wiki-nav" style={{marginTop: '2rem'}}>

        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
          <span style={{fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '0.05em'}}>Pages</span>
          <div className="wiki-nav-actions">
            {canManageSections && (
              <button
                className="btn-text wiki-nav-manage-button"
                onClick={onOpenAdmin}
                title="Manage Sections"
              >
                Sections
              </button>
            )}
            <button
              onClick={onCreatePage}
              className="btn btn-secondary"
              style={{padding: '0.2rem 0.5rem', fontSize: '0.8rem'}}
              title={canCreatePage ? 'New Page' : 'No writable sections available'}
              disabled={!canCreatePage}
            >
              +
            </button>
          </div>
        </div>

        <div className="wiki-nav-search">
          <input
            type="text"
            className="wiki-search-input"
            placeholder="Search pages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="wiki-nav-list">
          {Object.keys(pagesBySection).map(secId => (
            <div key={secId} style={{marginBottom: '1rem'}}>
               <div style={{fontSize: '0.8rem', fontWeight: 600, color: '#4b5563', padding: '0 0.5rem', marginBottom: '0.25rem'}}>
                   {pagesBySection[secId].title}
               </div>
               <ul>
                     {pagesBySection[secId].pages.map(page => (
                      <li key={page.title} className="wiki-nav-item">
                      <a
                        href={`#${encodeURIComponent(page.title)}`}
                        onClick={(e) => { e.preventDefault(); onSelectPage(page.title); }}
                        className={`wiki-nav-link ${currentPageTitle === page.title ? 'active' : ''}`}
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
  const [groups, setGroups] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [pages, setPages] = useState([]);
  const [sections, setSections] = useState({});
  const [currentPageTitle, setCurrentPageTitle] = useState('Home');
  const [currentPageData, setCurrentPageData] = useState(null);
  const [viewMode, setViewMode] = useState('read'); // read, edit, history, new, admin
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [tick, setTick] = useState(0); // Force update trigger

  // Load Initial Data
  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        const [loadedUsers, loadedGroups, loadedPages, loadedSections] = await Promise.all([
          wikiApi.getWikiUsers(),
          wikiApi.getWikiGroups(),
          wikiApi.getWikiPages(),
          wikiApi.getWikiSections()
        ]);

        const groupMap = normalizeGroups(loadedGroups);
        const usersWithGroups = buildUsersWithGroups(loadedUsers, groupMap);
        const sectionMap = loadedSections.reduce((acc, section) => {
          acc[section.title] = section;
          return acc;
        }, {});

        let initialUser = currentUser ? usersWithGroups.find(user => user.id === currentUser.id) : null;
        if (!initialUser) {
            const storedId = localStorage.getItem('wiki_user_id');
            if (storedId) initialUser = usersWithGroups.find(u => u.id === storedId);
        }
        if (!initialUser) initialUser = usersWithGroups[0] || null;

        if (initialUser) {
          setCurrentUser(initialUser);
          localStorage.setItem('wiki_user_id', initialUser.id);
        }

        const nextPageTitle = loadedPages.some(page => page.title === currentPageTitle)
          ? currentPageTitle
          : (loadedPages[0]?.title || null);

        setUsers(usersWithGroups);
        setGroups(groupMap);
        setPages(loadedPages);
        setSections(sectionMap);
        setCurrentPageTitle(nextPageTitle);
        setErrorMessage('');
      } catch (error) {
        setErrorMessage(error.message || 'Failed to load wiki data');
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [tick]); // Reload all data on tick

  // Update Current Page Data when dependencies change
  useEffect(() => {
    const loadPage = async () => {
      try {
        if (currentPageTitle) {
          const page = await wikiApi.getWikiPage(currentPageTitle);
          setCurrentPageData(page);
        } else {
          setCurrentPageData(null);
        }
      } catch (error) {
        if (pages.length > 0) {
          const fallbackPageTitle = pages[0]?.title || null;
          if (fallbackPageTitle && fallbackPageTitle !== currentPageTitle) {
            setCurrentPageTitle(fallbackPageTitle);
            return;
          }
        }
        setCurrentPageData(null);
        setErrorMessage(error.message || 'Failed to load the selected page');
      }
    };
    loadPage();
  }, [currentPageTitle, pages, tick]);

  const handleSwitchUser = (userId) => {
    const user = users.find(u => u.id === userId);
    if (user) {
        setCurrentUser(user);
        localStorage.setItem('wiki_user_id', userId);
        setTick(t => t + 1); // Refresh data with new user permissions
    }
  };

  const handleSelectPage = (title) => {
    setErrorMessage('');
    setCurrentPageTitle(title);
    setViewMode('read');
  };

  const handleCreatePage = () => {
    setErrorMessage('');
    setCurrentPageTitle(null);
    setViewMode('new');
  };

  const currentPageContent = currentPageData?.currentRevision?.content || '';

  // Derived state for permissions
  // Logic: Check section permissions for current page.
    const currentSection = currentPageData ? sections[currentPageData.sectionId] : null;
    const canEdit = currentUser && currentSection
      ? hasGroupAccess(currentSection.writeGroups, currentUser)
      : false;

    const canDelete = currentUser && currentUser.isAdmin;
    const writableSections = Object.values(sections).filter(section => hasGroupAccess(section.writeGroups, currentUser));
    const canCreatePage = writableSections.length > 0;
    const canManageSections = Boolean(currentUser?.isAdmin);

  if (loading) return <div className="wiki-container">Loading...</div>;

  return (
    <div className="wiki-container">
      <Sidebar
        pages={pages}
        sections={sections}
        currentPageTitle={currentPageTitle}
        onSelectPage={handleSelectPage}
        onCreatePage={handleCreatePage}
        currentUser={currentUser}
        users={users}
        onSwitchUser={handleSwitchUser}
        onOpenAdmin={() => canManageSections && setViewMode('admin')}
        canCreatePage={canCreatePage}
        canManageSections={canManageSections}
      />

      <main className="wiki-main">
        {errorMessage && (
          <div className="wiki-banner wiki-banner-error">
            <span>{errorMessage}</span>
            <button className="btn btn-secondary" onClick={() => setTick(t => t + 1)}>Retry</button>
          </div>
        )}

        {viewMode === 'admin' && (
            <AdminPanel
                users={users}
              groups={groups}
                sections={sections}
                onUpdate={() => setTick(t => t + 1)}
            onClose={() => setViewMode('read')}
            currentUser={currentUser}
            />
        )}

        {viewMode === 'read' && currentPageData && (
          <PageViewer
            page={currentPageData}
            onEdit={() => setViewMode('edit')}
            onHistory={() => setViewMode('history')}
            canEdit={canEdit}
            pendingRevisions={currentPageData.pendingRevisions}
            isApprover={Boolean(
              currentUser && (
                hasGroupAccess(sections[currentPageData.sectionId]?.approverGroups, currentUser)
                || currentPageData.pendingRevisions?.some(revision => hasGroupAccess(sections[revision.sectionId]?.approverGroups, currentUser))
              )
            )}
            currentUser={currentUser}
            onApprove={async (index) => {
               if(window.confirm("Approve this revision?")) {
                  try {
                  await wikiApi.approveWikiRevision(currentPageData.title, index, currentUser.id);
                      setTick(t => t + 1);
                  } catch(e) { alert(e.message); }
               }
            }}
            onReject={async (index) => {
               if(window.confirm("Reject this revision?")) {
                   try {
                     await wikiApi.rejectWikiRevision(currentPageData.title, index, currentUser.id);
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
            initialContent={currentPageContent}
            initialSectionId={currentPageData.sectionId}
            sections={writableSections}
            onCancel={() => setViewMode('read')}
            onSave={async (title, content, sectionId) => {
              try {
                const res = await wikiApi.saveWikiPage(title, content, currentUser.id, sectionId);
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
            sections={writableSections}
            onCancel={() => setViewMode('read')}
            onSave={async (title, content, sectionId) => {
              const normalizedTitle = title.trim();
              if (!normalizedTitle) return alert("Please enter a valid title");
              const exists = pages.some(p => p.title.toLowerCase() === normalizedTitle.toLowerCase());
              if (exists) return alert("Page already exists");
              if (!sectionId) return alert("No writable section is available");

              try {
                const res = await wikiApi.saveWikiPage(normalizedTitle, content, currentUser.id, sectionId);
                 if (res.status === 'pending') {
                    alert("Page submitted for review.");
                    // Go to home or stay?
                }
                setCurrentPageTitle(normalizedTitle);
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
                 try {
                   await wikiApi.revertWikiPage(currentPageData.title, version, currentUser.id);
                   setTick(t => t + 1);
                   setViewMode('read');
                 } catch (e) {
                   alert(e.message);
                 }
               }
            }}
          />
        )}
      </main>
    </div>
  );
}
