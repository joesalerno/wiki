import React, { useEffect, useRef, useState } from 'react'
import { wikiApi } from './wikiApi'
import { renderMarkdown } from './wikiMarkdown'
import './Wiki.css'

const ADMIN_GROUPS = new Set(['admin', 'wiki_admin'])
const ADMIN_PERMISSION_GROUP = 'wiki_admin'

const dedupeItems = (values) => [...new Set((values || []).filter(Boolean))]

function withRequiredAdminPermission(groups) {
  return dedupeItems([
    ADMIN_PERMISSION_GROUP,
    ...(groups || []).map(groupName => ADMIN_GROUPS.has(groupName) ? ADMIN_PERMISSION_GROUP : groupName)
  ])
}

function hasGroupAccess(groupNames, user) {
  if (user?.isAdmin) return true
  if (!groupNames || groupNames.length === 0) return true
  if (!user) return false
  const userGroups = new Set(user.groups || [])
  return (groupNames || []).some(groupName => userGroups.has(groupName))
}

function stripAdminPermission(items) {
  return (items || []).filter(item => !ADMIN_GROUPS.has(item))
}

function getPermissionSummaryItems(items) {
  const explicitItems = stripAdminPermission(items)
  return explicitItems.length > 0
    ? withRequiredAdminPermission(explicitItems)
    : []
}

function formatReadGroups(items) {
  const visibleItems = stripAdminPermission(items)
  return visibleItems.length > 0 ? visibleItems.join(', ') : 'Anyone'
}

function formatWriteGroups(items) {
  const visibleItems = stripAdminPermission(items)
  return visibleItems.length > 0 ? visibleItems.join(', ') : 'Anyone'
}

function formatApproverGroups(items) {
  const visibleItems = stripAdminPermission(items)
  if (visibleItems.length === 0 && (items || []).includes(ADMIN_PERMISSION_GROUP)) {
    return 'Admins'
  }
  return visibleItems.length > 0 ? visibleItems.join(', ') : 'Anyone'
}

function isPageReviewRequired(page, section) {
  if (page?.reviewMode === 'required') return true
  if (page?.reviewMode === 'exempt') return false
  return Boolean(section?.reviewRequired)
}

function getPageApproverGroups(page, section) {
  if (!isPageReviewRequired(page, section)) {
    return []
  }

  const approverGroups = section?.approverGroups || []
  return approverGroups.length > 0 ? approverGroups : [ADMIN_PERMISSION_GROUP]
}

function canApprovePageReview(page, section, user) {
  const approverGroups = getPageApproverGroups(page, section)
  if (approverGroups.length === 0) {
    return false
  }
  return hasGroupAccess(approverGroups, user)
}

const formatPageReviewMode = m => m === "required" ? "Required" : m === "exempt" ? "Exempt" : "Inherit"

const getReviewIndicatorClassName = (c, e = "") => ["wiki-review-indicator", c > 0 ? "is-pending" : "is-clear", e].filter(Boolean).join(" ")

function formatReviewIndicatorTitle(page) {
  if ((page?.pendingReviewCount || 0) > 0) {
    return page.pendingReviewCount === 1
      ? '1 change is waiting for review'
      : `${page.pendingReviewCount} changes are waiting for review`
  }
  const reviewedAt = page?.approvedAt || page?.updatedAt
  const reviewedBy = page?.approvedBy || page?.authorId
  if (reviewedAt && reviewedBy) return `Reviewed ${new Date(reviewedAt).toLocaleDateString()} by ${reviewedBy}`
  return 'Reviewed'
}

const getDraftReviewMode = (p, t) => p?.reviewMode || (t?.trim() === "Home" ? "required" : "inherit")

function createEmptySectionForm() {
  return {
    title: '',
    readGroups: withRequiredAdminPermission([]),
    writeGroups: withRequiredAdminPermission([]),
    approverGroups: [],
    reviewRequired: false
  }
}

function createSectionFormData(section) {
  if (!section) return createEmptySectionForm()
  return {
    ...section,
    readGroups: withRequiredAdminPermission(section.readGroups || []),
    writeGroups: withRequiredAdminPermission(section.writeGroups || []),
    approverGroups: section.reviewRequired ? withRequiredAdminPermission(section.approverGroups || []) : [],
    reviewRequired: Boolean(section.reviewRequired)
  }
}

function toggleSelectedValue(values, value) {
  return values.includes(value)
    ? values.filter(entry => entry !== value)
    : [...values, value]
}

const normalizeGroupMap = (groups) => Object.fromEntries(
  (groups || []).map(group => {
    const memberIds = (group.users || []).map(user => user.id)
    return [group.name, { ...group, memberIds }]
  })
)

function SelectionChips({ items, emptyLabel }) {
  if (!items || items.length === 0) {
    return <div className="wiki-picker-empty">{emptyLabel}</div>
  }
  return (
    <div className="wiki-picker-chips">
      {items.map(item => (
        <span key={item} className="wiki-picker-chip">{item}</span>
      ))}
    </div>
  )
}

function FilterableChecklist({
  filterValue,
  onFilterChange,
  filterPlaceholder,
  options,
  selectedValues,
  displayValues,
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
          const checked = selectedValues.includes(option.value)
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
          )
        })}
      </div>
      <div className="wiki-picker-summary-label">{selectedSummaryLabel}</div>
      <SelectionChips items={displayValues ?? selectedValues} emptyLabel={emptySelectionLabel} />
    </div>
  )
}

function PageViewer({ page, onEdit, onHistory, canEdit, pendingRevisions, onApprove, onReject, isApprover, currentUser }) {
  if (!page) return <div>Page not found</div>
  const { title, currentRevision } = page
  const currentSectionId = page.sectionId || 'Unassigned'
  const reviewedAt = currentRevision?.approvedAt || currentRevision?.timestamp || null
  const reviewedById = currentRevision?.approvedBy || currentRevision?.authorId || null
  return (
    <div className="wiki-article">
      <div className="wiki-content-area">
        <div className="wiki-header">
          <h1 className="wiki-header-title">{title}</h1>
          <div className="wiki-header-actions">
            <button className="btn btn-minimal" onClick={onHistory} title="View History">
              <span style={{ fontSize: '1.2rem', marginRight: '0.25rem' }}>↺</span> History
            </button>
            <span title={canEdit ? 'Edit Page' : "You don't have permission to edit this page."}>
              <button
                title={canEdit ? 'Edit Page' : undefined}
                className="btn btn-sm btn-primary"
                onClick={onEdit}
                disabled={!canEdit}
              >
                Edit Page
              </button>
            </span>
          </div>
        </div>
        {pendingRevisions && pendingRevisions.length > 0 && (
          <div style={{ marginBottom: '1.5rem', border: '1px solid #f59e0b', backgroundColor: '#fffbeb', borderRadius: '0.5rem', padding: '1rem' }}>
            <h3 style={{ fontSize: '1rem', color: '#92400e', marginTop: 0 }}>⚠️ Pending Revisions</h3>
            <p style={{ fontSize: '0.9rem', color: '#b45309' }}>
              There are {pendingRevisions.length} changes waiting for approval.
            </p>
            {isApprover ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
                {pendingRevisions.map((rev, idx) => {
                  const targetSectionId = rev.sectionId || currentSectionId
                  const sectionChanged = targetSectionId !== currentSectionId
                  const isOwnRevision = currentUser?.id === rev.authorId
                  const canApproveOwnRevision = isOwnRevision && currentUser?.isAdmin
                  const approveDisabled = isOwnRevision && !currentUser?.isAdmin

                  return (
                    <li key={idx} style={{ backgroundColor: 'white', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '0.25rem', border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ fontSize: '0.85rem' }}>
                          <strong>{rev.authorId}</strong> proposed changes on {new Date(rev.timestamp).toLocaleString()}
                          {sectionChanged && (
                            <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#92400e' }}>
                              Section change: <strong>{currentSectionId}</strong> to <strong>{targetSectionId}</strong>
                            </div>
                          )}
                          {canApproveOwnRevision && (
                            <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#92400e' }}>
                              Warning: you are approving your own revision.
                            </div>
                          )}
                        </div>
                        <div>
                          <button
                            className="btn btn-sm btn-primary"
                            style={{
                              marginRight: '0.5rem',
                              backgroundColor: approveDisabled ? '#9ca3af' : '#10b981',
                              borderColor: approveDisabled ? '#9ca3af' : '#059669',
                              cursor: approveDisabled ? 'not-allowed' : 'pointer'
                            }}
                            onClick={() => onApprove(idx, rev)}
                            disabled={approveDisabled}
                            title={approveDisabled ? "Cannot approve your own changes unless you are an admin" : canApproveOwnRevision ? "Approve your own revision" : "Approve"}
                          >
                            Approve
                          </button>
                          <button className="btn btn-sm btn-secondary" style={{ color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => onReject(idx)}>Reject</button>
                        </div>
                      </div>
                      <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #eee', fontSize: '0.8rem', padding: '0.5rem', backgroundColor: '#f9fafb' }}>
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
                  )
                })}
              </ul>
            ) : (
              <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#b45309' }}>You do not have permission to approve these changes.</div>
            )}
          </div>
        )}

        <div style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {currentRevision && (
            <>
              <span style={{ backgroundColor: '#e5e7eb', color: '#374151', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem' }}>
                v{currentRevision.version}
              </span>
              <span>Updated {new Date(currentRevision.timestamp).toLocaleDateString()} by {currentRevision.authorId}</span>
              {reviewedAt && reviewedById && (
                <span className="wiki-review-meta">
                  Reviewed {new Date(reviewedAt).toLocaleDateString()} by {reviewedById}
                </span>
              )}
            </>
          )}
          {!currentRevision && <span>No published content.</span>}
        </div>

        <div className="wiki-body">
          {currentRevision ? renderMarkdown(currentRevision.content) : <p>This page has no content yet.</p>}
        </div>
      </div>
    </div>
  )
}

function PageEditor({ page, initialTitle, initialContent, initialSectionId, initialReviewMode, sections, onSave, onCancel, onDirtyChange }) {
  const initialResolvedTitle = initialTitle || ''
  const initialResolvedContent = initialContent || ''
  const initialResolvedSectionId = initialSectionId || (sections[0]?.title || '')
  const [title, setTitle] = useState(initialTitle || '')
  const [content, setContent] = useState(initialContent || '')
  const [sectionId, setSectionId] = useState(initialSectionId || (sections[0]?.title || ''))
  const [activeTab, setActiveTab] = useState('write') // 'write' or 'preview'
  const [isUploading, setIsUploading] = useState(false)
  const textareaRef = useRef(null)
  const imageInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const normalizedTitle = title.trim()
  const isExistingPage = Boolean(page)
  const isHomePage = page?.title === 'Home'
  const isTitleChanged = title !== initialResolvedTitle
  const isSectionChanged = sectionId !== initialResolvedSectionId
  const hasAvailableSection = sections.length > 0
  const hasChanges = title !== initialResolvedTitle
    || content !== initialResolvedContent
    || sectionId !== initialResolvedSectionId
  const canSave = !isUploading && hasChanges && hasAvailableSection && (isExistingPage || normalizedTitle.length > 0)
  const draftStorageKey = page ? `wiki_draft:${page.title}` : 'wiki_draft:new_page'
  const [draftInitialized, setDraftInitialized] = useState(false)
  const activeSection = sections.find(section => section.title === sectionId) || null
  const draftReviewMode = getDraftReviewMode(page ? { ...page, reviewMode: initialReviewMode } : null, title)
  const reviewRequired = isPageReviewRequired({ reviewMode: draftReviewMode }, activeSection)
  const approverGroups = getPageApproverGroups({ reviewMode: draftReviewMode }, activeSection)

  useEffect(() => {
    if (!sections.length) {
      if (sectionId !== '') setSectionId('')
      return
    }
    const hasCurrentSection = sections.some(section => section.title === sectionId)
    if (!hasCurrentSection) {
      setSectionId(initialResolvedSectionId)
    }
  }, [initialResolvedSectionId, sectionId, sections])

  useEffect(() => {
    setTitle(initialResolvedTitle)
    setContent(initialResolvedContent)
    setSectionId(initialResolvedSectionId)
    setActiveTab('write')
    setDraftInitialized(false)
    try {
      const rawDraft = localStorage.getItem(draftStorageKey)
      if (!rawDraft) {
        setDraftInitialized(true)
        return
      }
      const savedDraft = JSON.parse(rawDraft)
      const restoredTitle = typeof savedDraft?.title === 'string' ? savedDraft.title : initialResolvedTitle
      const restoredContent = typeof savedDraft?.content === 'string' ? savedDraft.content : initialResolvedContent
      const restoredSectionId = sections.some(section => section.title === savedDraft?.sectionId)
        ? savedDraft.sectionId
        : initialResolvedSectionId
      const hasRecoveredDraft = restoredTitle !== initialResolvedTitle
        || restoredContent !== initialResolvedContent
        || restoredSectionId !== initialResolvedSectionId
      if (!hasRecoveredDraft) {
        localStorage.removeItem(draftStorageKey)
        setDraftInitialized(true)
        return
      }
      setTitle(restoredTitle)
      setContent(restoredContent)
      setSectionId(restoredSectionId)
      setDraftInitialized(true)
    } catch {
      localStorage.removeItem(draftStorageKey)
      setDraftInitialized(true)
    }
  }, [draftStorageKey, initialResolvedContent, initialResolvedSectionId, initialResolvedTitle, sections])

  useEffect(() => {
    if (!draftInitialized) return
    if (hasChanges) {
      localStorage.setItem(draftStorageKey, JSON.stringify({
        title,
        content,
        sectionId,
        updatedAt: Date.now()
      }))
      return
    }
    localStorage.removeItem(draftStorageKey)
  }, [content, draftInitialized, draftStorageKey, hasChanges, sectionId, title])

  useEffect(() => {
    onDirtyChange?.(hasChanges)
    return () => onDirtyChange?.(false)
  }, [hasChanges, onDirtyChange])

  const handleReset = () => {
    setTitle(initialResolvedTitle)
    setContent(initialResolvedContent)
    setSectionId(initialResolvedSectionId)
    setActiveTab('write')
  }

  const insertSnippet = (snippet, selectionOffset = snippet.length) => {
    const textarea = textareaRef.current
    const start = textarea ? textarea.selectionStart : content.length
    const end = textarea ? textarea.selectionEnd : content.length
    const nextContent = `${content.slice(0, start)}${snippet}${content.slice(end)}`
    setContent(nextContent)
    requestAnimationFrame(() => {
      if (!textareaRef.current) return
      textareaRef.current.focus()
      const nextCursor = start + selectionOffset
      textareaRef.current.setSelectionRange(nextCursor, nextCursor)
    })
  }

  const wrapSelection = (prefix, suffix = prefix, placeholder = 'text') => {
    const textarea = textareaRef.current
    const start = textarea ? textarea.selectionStart : content.length
    const end = textarea ? textarea.selectionEnd : content.length
    const selection = content.slice(start, end) || placeholder
    const snippet = `${prefix}${selection}${suffix}`
    const selectionOffset = prefix.length + selection.length + suffix.length
    insertSnippet(snippet, selectionOffset)
  }

  const insertLineTemplate = (template) => {
    const textarea = textareaRef.current
    const start = textarea ? textarea.selectionStart : content.length
    const prefix = start > 0 && !content.slice(0, start).endsWith('\n') ? '\n' : ''
    const suffix = content.endsWith('\n') || !content ? '' : '\n'
    insertSnippet(`${prefix}${template}${suffix}`)
  }

  const handleUpload = async (event, kind) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setIsUploading(true)
      const asset = await wikiApi.uploadWikiAsset(file)
      const snippet = kind === 'image' && asset.isImage
        ? asset.markdown
        : asset.isImage && kind === 'file'
          ? `[${asset.fileName}](${asset.url})`
          : asset.markdown
      insertLineTemplate(snippet)
      setActiveTab('write')
    } catch (error) {
      alert(error.message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="wiki-editor-container">
      <div className="wiki-content-area" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="wiki-header">
          {/* If creating a new page, title is editable, otherwise static header */}
          {!page ? (
            <h1 className="wiki-header-title">New Page</h1>
          ) : (
            <h1 className="wiki-header-title">Editing {page.title}</h1>
          )}
          <div className="wiki-header-actions">
            {hasChanges && (
              <div className="wiki-editor-status wiki-header-status">
                <span>Changes saved locally on this device.</span>
              </div>
            )}
            <button className="btn btn-sm btn-secondary" onClick={handleReset} disabled={!hasChanges || isUploading}>Reset</button>
            <button className="btn btn-sm btn-secondary" onClick={onCancel}>Cancel</button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => onSave(title, content, sectionId, page?.title || null)}
              disabled={!canSave}
              title={
                !hasAvailableSection
                  ? 'No writable sections available'
                  : !hasChanges
                    ? 'No changes to save'
                    : isUploading
                      ? 'Upload in progress'
                      : reviewRequired
                        ? 'Submit changes for review'
                        : 'Publish changes'
              }
            >
              Save Changes
            </button>
          </div>
        </div>
        <div className="wiki-editor-meta" style={{ display: 'flex', gap: '1rem' }}>
          <div className="wiki-editor-field" style={{ flex: 2 }}>
            <label className="wiki-editor-label">Page Name</label>
            <input
              type="text"
              className="wiki-input-text"
              style={{ color: isTitleChanged ? '#0000ff' : undefined }}
              placeholder="Page Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={isHomePage}
              title={isHomePage ? 'The Home page cannot be renamed.' : undefined}
            />
          </div>
          <div className="wiki-editor-field" style={{ flex: 1 }}>
            <label className="wiki-editor-label" style={{ color: isSectionChanged ? '#0000ff' : undefined }}>Section</label>
            <select
              className="wiki-input-text"
              style={{
                color: isSectionChanged ? '#0000ff' : '#000000',
                borderColor: isSectionChanged ? '#0000ff' : undefined,
                boxShadow: isSectionChanged ? '0 0 0 1px #0000ff inset' : undefined
              }}
              value={sectionId}
              onChange={e => setSectionId(e.target.value)}
              disabled={!hasAvailableSection}
            >
              {sections.map(s => (
                <option
                  key={s.title}
                  value={s.title}
                  className={s.title === initialResolvedSectionId ? 'wiki-section-option-current' : 'wiki-section-option-changed'}
                  style={{ color: s.title === initialResolvedSectionId ? '#000000' : '#0000ff' }}
                >
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!hasAvailableSection && (
          <div className="wiki-inline-notice">
            You do not have a writable section available for this page.
          </div>
        )}
        {hasAvailableSection && (
          <div className={`wiki-review-summary wiki-review-summary-editor ${reviewRequired ? 'is-required' : 'is-direct'}`}>
            <div className="wiki-review-summary-title">
              {reviewRequired ? `Saves submit for review by ${formatApproverGroups(approverGroups)}.` : 'Saves publish immediately.'}
            </div>
          </div>
        )}
        <div className="wiki-editor-tabs-row">
          <div className="wiki-editor-tabs">
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
          <div className="wiki-article" style={{ flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem' }}>
            {renderMarkdown(content)}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Simple Diff Utility ---
const computeDiff = (oldText, newText) => {
  if (!oldText) oldText = ""
  if (!newText) newText = ""
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  // Very naive line-by-line diff for demonstration
  // Real diff algos are complex, this just shows what lines match roughly or creates a visual output
  const output = []
  let i = 0
  let j = 0
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      output.push({ type: 'same', text: oldLines[i] })
      i++
      j++
    } else if (j < newLines.length && (i >= oldLines.length || !oldLines.includes(newLines[j]))) {
      // New line added
      output.push({ type: 'added', text: newLines[j] })
      j++
    } else if (i < oldLines.length) {
      // Old line removed
      output.push({ type: 'removed', text: oldLines[i] })
      i++
    }
  }
  return output
}

function PageHistory({ page, onBack, onRevert, canRevert }) {
  const [revisions, setRevisions] = useState([])
  const [expandedView, setExpandedView] = useState({ version: null, mode: null }) // mode: 'diff' | 'full'
  const currentRevisionVersion = page?.currentRevision?.version ?? null

  useEffect(() => {
    if (page) wikiApi.getWikiPageHistory(page.title).then(setRevisions)
  }, [page])
  if (!page) return null

  const handleToggleDiff = (version) => {
    if (expandedView.version === version && expandedView.mode === 'diff') {
      setExpandedView({ version: null, mode: null })
    } else {
      setExpandedView({ version, mode: 'diff' })
    }
  }
  const handleToggleFull = (version) => {
    if (expandedView.version === version && expandedView.mode === 'full') {
      setExpandedView({ version: null, mode: null })
    } else {
      setExpandedView({ version, mode: 'full' })
    }
  }

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
            const prevRev = revisions[index + 1]
            const isDiffOpen = expandedView.version === rev.version && expandedView.mode === 'diff'
            const isFullOpen = expandedView.version === rev.version && expandedView.mode === 'full'

            return (
              <React.Fragment key={rev.version}>
                <li className="history-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div className="history-meta">
                      <span className="history-version">Version {rev.version}</span>
                      <span className="history-author">
                        Edited by {rev.authorId} on {new Date(rev.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="history-actions">
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', marginRight: '0.5rem' }}
                        onClick={() => handleToggleDiff(rev.version)}
                      >
                        {isDiffOpen ? 'Hide Changes' : 'Show Changes'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', marginRight: '0.5rem' }}
                        onClick={() => handleToggleFull(rev.version)}
                      >
                        {isFullOpen ? 'Hide Full' : 'Show Full'}
                      </button>

                      {canRevert && rev.version !== currentRevisionVersion && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.8rem' }}
                          onClick={() => onRevert(rev.version)}
                        >
                          Revert to this
                        </button>
                      )}
                      {rev.version === currentRevisionVersion && (
                        <span style={{ fontSize: '0.8rem', color: 'green', fontWeight: 600, padding: '0.2rem 0.5rem' }}>Current</span>
                      )}
                    </div>
                  </div>
                  {isDiffOpen && (
                    <div style={{ marginTop: '1rem', background: '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', fontSize: '0.9rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
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
                    <div style={{ marginTop: '1rem', background: '#fff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                      {renderMarkdown(rev.content)}
                    </div>
                  )}
                </li>
              </React.Fragment>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function AdminPanel({ sections, pages, onUpdate, onClose, currentUser }) {
  const [activeTab, setActiveTab] = useState('sections')
  const [editingSectionId, setEditingSectionId] = useState(null)
  const [sectionFormData, setSectionFormData] = useState({})
  const [editingPageTitle, setEditingPageTitle] = useState(null)
  const [pageReviewMode, setPageReviewMode] = useState('inherit')
  const [sectionFilter, setSectionFilter] = useState('')
  const [pageFilter, setPageFilter] = useState('')
  const [permissionGroupFilter, setPermissionGroupFilter] = useState('')
  const [groups, setGroups] = useState({})
  const [managementDataError, setManagementDataError] = useState('')
  const canManageSections = Boolean(currentUser?.isAdmin)

  useEffect(() => {
    let isCancelled = false
    if (!canManageSections) return
    const loadData = async () => {
      try {
        const loadedGroups = await wikiApi.getWikiGroups()
        if (isCancelled) return
        setGroups(normalizeGroupMap(loadedGroups))
        setManagementDataError('')
      } catch (error) {
        if (isCancelled) return
        setGroups({})
        setManagementDataError(error.message || 'Failed to load management data')
      }
    }
    loadData()
    return () => { isCancelled = true }
  }, [canManageSections])

  const filteredSections = Object.values(sections)
    .sort((left, right) => left.title.localeCompare(right.title))
    .filter(section => section.title.toLowerCase().includes(sectionFilter.toLowerCase()))
  const filteredPages = [...pages]
    .sort((left, right) => left.title.localeCompare(right.title))
    .filter(page => page.title.toLowerCase().includes(pageFilter.toLowerCase()))
  const homeSectionTitle = Object.values(pages || {}).find(page => page.title === 'Home')?.sectionId || null

  const groupOptions = Object.values(groups).sort((left, right) => left.name.localeCompare(right.name))
  const filteredPermissionGroups = groupOptions.filter(group => group.name.toLowerCase().includes(permissionGroupFilter.toLowerCase()))

  const isEditingSection = editingSectionId !== null, isEditingPage = editingPageTitle !== null
  const isEditing = isEditingSection || isEditingPage

  const permissionChecklistOptions = [
    { value: ADMIN_PERMISSION_GROUP, label: ADMIN_PERMISSION_GROUP, disabled: true },
    ...filteredPermissionGroups
      .filter(g => !ADMIN_GROUPS.has(g.name))
      .map(group => ({ value: group.name, label: group.name }))
  ]

  const startEditSection = (title, data) => {
    if (!canManageSections) return
    setActiveTab('sections')
    setEditingPageTitle(null)
    setEditingSectionId(title)
    setPermissionGroupFilter('')
    setSectionFormData(title === 'new' ? createEmptySectionForm() : createSectionFormData(data))
  }

  const startEditPage = (page) => {
    if (!canManageSections) return
    setActiveTab('pages')
    setEditingSectionId(null)
    setEditingPageTitle(page.title)
    setPageReviewMode(page.reviewMode || 'inherit')
  }

  const stopEditing = () => {
    setEditingSectionId(null)
    setEditingPageTitle(null)
    setPermissionGroupFilter('')
  }

  const handleSaveSection = async () => {
    try {
      if (editingSectionId === 'new') {
        await wikiApi.createWikiSection(sectionFormData, currentUser?.id)
      } else {
        await wikiApi.updateWikiSection(editingSectionId, sectionFormData, currentUser?.id)
      }
      onUpdate()
      stopEditing()
    } catch (error) {
      alert(error.message)
    }
  }

  const handleDeleteSection = async (title) => {
    if (!window.confirm('Are you sure?')) return
    try {
      await wikiApi.deleteWikiSection(title, currentUser?.id)
      onUpdate()
    } catch (error) {
      alert(error.message)
    }
  }

  const handleSavePage = async () => {
    try {
      await wikiApi.updateWikiPageReviewMode(editingPageTitle, pageReviewMode, currentUser?.id)
      onUpdate()
      stopEditing()
    } catch (error) {
      alert(error.message)
    }
  }

  const renderSectionForm = () => {
    const isSectionTitleChanged = (sectionFormData.title || '') !== (editingSectionId === 'new' ? '' : editingSectionId)
    return (
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
            style={{ color: isSectionTitleChanged ? '#0000ff' : undefined }}
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
              displayValues={getPermissionSummaryItems(sectionFormData.readGroups || [])}
              onToggle={(value) => setSectionFormData({
                ...sectionFormData,
                readGroups: withRequiredAdminPermission(toggleSelectedValue(sectionFormData.readGroups || [], value))
              })}
              emptyResultsLabel="No groups match this filter."
              selectedSummaryLabel="Selected read groups"
              emptySelectionLabel="Anyone can read this section"
              height={150}
            />
          </div>
          <div className="wiki-admin-field">
            <label className="wiki-admin-label">Write Groups</label>
            <FilterableChecklist
              options={permissionChecklistOptions}
              selectedValues={withRequiredAdminPermission(sectionFormData.writeGroups || [])}
              displayValues={getPermissionSummaryItems(sectionFormData.writeGroups || [])}
              onToggle={(value) => setSectionFormData({
                ...sectionFormData,
                writeGroups: withRequiredAdminPermission(toggleSelectedValue(sectionFormData.writeGroups || [], value))
              })}
              emptyResultsLabel="No groups match this filter."
              selectedSummaryLabel="Selected write groups"
              emptySelectionLabel="Anyone can write in this section"
              height={150}
            />
          </div>
          {sectionFormData.reviewRequired && (
            <div className="wiki-admin-field">
              <label className="wiki-admin-label">Approver Groups</label>
              <FilterableChecklist
                options={permissionChecklistOptions}
                selectedValues={withRequiredAdminPermission(sectionFormData.approverGroups || [])}
                displayValues={getPermissionSummaryItems(sectionFormData.approverGroups || [])}
                onToggle={(value) => setSectionFormData({
                  ...sectionFormData,
                  approverGroups: withRequiredAdminPermission(toggleSelectedValue(sectionFormData.approverGroups || [], value))
                })}
                emptyResultsLabel="No groups match this filter."
                selectedSummaryLabel="Selected approver groups"
                emptySelectionLabel="Anyone can approve revisions in this section"
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
    )
  }

  const renderPageForm = () => {
    const currentPage = pages.find(page => page.title === editingPageTitle)
    const currentSection = currentPage ? sections[currentPage.sectionId] : null
    return <div className="admin-form" style={{ marginBottom: '1.5rem' }}>
      <div className="wiki-admin-editor-header">
        <div>
          <h2 className="wiki-admin-editor-title">Editing {editingPageTitle}</h2>
          <div className="wiki-admin-editor-subtitle">Override the section review rule only when a page needs special handling.</div>
        </div>
      </div>
      <div className="wiki-admin-field">
        <label className="wiki-admin-label">Review Policy</label>
        <select
          className="wiki-input-text"
          value={pageReviewMode}
          onChange={event => setPageReviewMode(event.target.value)}
          style={{ fontSize: '1rem', fontWeight: 500 }}
        >
          <option value="inherit">Inherit section policy</option>
          <option value="required">Require review</option>
          <option value="exempt">Skip review</option>
        </select>
        <div className="wiki-admin-help">
          Current section rule: {currentSection?.reviewRequired ? 'review required' : 'review not required'}.
        </div>
        <div className="wiki-admin-help">
          If review is required and the section has no approver groups, approval falls back to admins.
        </div>
      </div>
      <div className="admin-actions" style={{ marginTop: '1rem' }}>
        <button className="btn btn-sm btn-primary" onClick={handleSavePage}>Save</button>
        <button className="btn btn-sm btn-secondary" onClick={stopEditing}>Close Page Editor</button>
      </div>
    </div>
  }

  return <div className="wiki-article">
    <div className="wiki-content-area">
      <div className="wiki-header">
        <h1 className="wiki-header-title">Wiki Management</h1>
        <button className="btn btn-sm btn-secondary" onClick={onClose}>Close</button>
      </div>
      {!canManageSections && <div className="wiki-inline-notice">
        Only admin or wiki_admin members can manage sections and page policies.
      </div>}
      {canManageSections && managementDataError && <div className="wiki-inline-notice">
        {managementDataError}
      </div>}
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
          aria-selected={activeTab === 'pages'}
          className={`wiki-admin-tab ${activeTab === 'pages' ? 'active' : ''}`}
          onClick={() => !isEditing && setActiveTab('pages')}
          disabled={isEditing && !isEditingPage}
        >
          Pages
        </button>
      </div>

      {isEditingSection && renderSectionForm()}
      {isEditingPage && renderPageForm()}

      {!isEditing && activeTab === 'sections' && (
        <div>
          <div style={{ marginBottom: '1rem' }}>
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

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.5rem' }}>Title</th>
                <th style={{ padding: '0.5rem' }}>Details</th>
                <th style={{ padding: '0.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSections.map(s => (
                <tr key={s.title} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.5rem' }}>{s.title}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <div><strong>{s.title}</strong></div>
                    <div style={{ fontSize: '0.8rem' }}>
                      <span style={{ color: '#059669' }}>R: {formatReadGroups(s.readGroups)}</span> |
                      <span style={{ color: '#d97706' }}> W: {formatWriteGroups(s.writeGroups)}</span>
                    </div>
                    {s.reviewRequired && <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>Review Required (Approvers: {formatApproverGroups(s.approverGroups)})</div>}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <button className="btn-text" onClick={() => startEditSection(s.title, s)} disabled={!canManageSections}>Edit Section</button>
                    <button
                      className="btn-text"
                      style={{ color: '#9ca3af', marginLeft: '0.5rem', cursor: canManageSections ? 'pointer' : 'not-allowed' }}
                      onClick={() => canManageSections && s.title !== homeSectionTitle && handleDeleteSection(s.title)}
                      disabled={!canManageSections || s.title === homeSectionTitle}
                      title={s.title === homeSectionTitle ? 'Cannot delete the section that contains the Home page' : (canManageSections ? 'Delete Section' : "You don't have permission to delete sections")}
                    >
                      Delete
                    </button>
                    {(!canManageSections || s.title === homeSectionTitle) && (
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                        {s.title === homeSectionTitle ? 'This section contains the Home page and cannot be deleted.' : "You don't have permission to delete sections."}
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

      {!isEditing && activeTab === 'pages' && (
        <div>
          <input
            type="text"
            placeholder="Filter pages"
            value={pageFilter}
            onChange={e => setPageFilter(e.target.value)}
            style={{ marginBottom: '1rem', maxWidth: '320px' }}
          />

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.5rem' }}>Page</th>
                <th style={{ padding: '0.5rem' }}>Section</th>
                <th style={{ padding: '0.5rem' }}>Review Policy</th>
                <th style={{ padding: '0.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPages.map(page => {
                const section = sections[page.sectionId]

                return (
                  <tr key={page.title} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.5rem' }}>{page.title}</td>
                    <td style={{ padding: '0.5rem' }}>{page.sectionId}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <div className="wiki-page-policy-cell">
                        <span>{formatPageReviewMode(page.reviewMode)}</span>
                        {isPageReviewRequired(page, section) && (
                          <span
                            className={getReviewIndicatorClassName(page.pendingReviewCount)}
                            title={formatReviewIndicatorTitle(page)}
                            aria-label={formatReviewIndicatorTitle(page)}
                          />
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <button className="btn-text" onClick={() => startEditPage(page)} disabled={!canManageSections}>Edit Policy</button>
                    </td>
                  </tr>
                )
              })}
              {filteredPages.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ padding: '0.75rem 0.5rem', color: '#6b7280', fontStyle: 'italic' }}>
                    No pages match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>

}


function Sidebar({ pages, sections, currentPageTitle, onSelectPage, onCreatePage, currentUser, onOpenAdmin, canCreatePage, canManageSections }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isNavOpen, setIsNavOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth > 900))
  const [collapsedSections, setCollapsedSections] = useState({})

  useEffect(() => {
    function handleResize() { if (window.innerWidth > 900) setIsNavOpen(true) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const filteredPages = pages.filter(page => page.title.toLowerCase().includes(searchTerm.toLowerCase()))

  function closeNavOnMobile() { if (typeof window !== 'undefined' && window.innerWidth <= 900) setIsNavOpen(false) }
  function toggleSection(sectionTitle) {
    setCollapsedSections(current => ({ ...current, [sectionTitle]: !current[sectionTitle] }))
  }

  // Group pages by section
  const pagesBySection = {}
  Object.values(sections).forEach(section => {
    const canRead = hasGroupAccess(section.readGroups, currentUser)
    if (canRead) {
      pagesBySection[section.title] = {
        title: section.title,
        pages: []
      }
    }
  })

  const defaultSectionTitle = Object.keys(sections)[0]
  filteredPages.forEach(page => {
    // If page belongs to a section visible to user
    const secTitle = page.sectionId || defaultSectionTitle
    if (pagesBySection[secTitle]) {
      pagesBySection[secTitle].pages.push(page)
    }
  })

  const visibleSections = Object.entries(pagesBySection)
    .filter(([, section]) => (searchTerm ? section.pages.length > 0 : true))
  const hasVisiblePages = visibleSections.some(([, section]) => section.pages.length > 0)

  return <aside className="wiki-sidebar">
    <div className="wiki-brand-row">
      <div className="wiki-brand">
        <span>Navigation</span>
      </div>
      <button
        type="button"
        className="wiki-sidebar-toggle"
        onClick={() => setIsNavOpen(open => !open)}
        aria-expanded={isNavOpen}
        aria-label={isNavOpen ? 'Collapse navigation' : 'Expand navigation'}
      >
        {isNavOpen ? 'Hide Menu' : 'Show Menu'}
      </button>
    </div>
    <div className={`wiki-sidebar-body ${isNavOpen ? 'open' : ''}`}>
      <div className="wiki-nav">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '0.05em' }}>Pages</span>
          <div className="wiki-nav-actions">
            {canManageSections && (
              <button
                className="btn-text wiki-nav-manage-button"
                onClick={() => {
                  const didOpen = onOpenAdmin()
                  if (didOpen !== false) closeNavOnMobile()
                }}
                title="Manage Sections"
              >
                Manage
              </button>
            )}
            <button
              onClick={() => {
                const didCreate = onCreatePage()
                if (didCreate !== false) closeNavOnMobile()
              }}
              className="btn btn-secondary"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
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
          {visibleSections.map(([secId, section]) => {
            const isCollapsed = !searchTerm && Boolean(collapsedSections[secId])
            return (
              <div key={secId} className="wiki-section-group">
                <button
                  type="button"
                  className="wiki-section-toggle"
                  onClick={() => toggleSection(secId)}
                  aria-expanded={!isCollapsed}
                >
                  <span>{isCollapsed ? '▸' : '▾'} {section.title}</span>
                  <span className="wiki-section-count">{section.pages.length}</span>
                </button>
                {!isCollapsed && <ul className="wiki-section-pages">
                  {section.pages.map(page => <li key={page.title} className="wiki-nav-item">
                    <a
                      href={`#${encodeURIComponent(page.title)}`}
                      onClick={(e) => {
                        e.preventDefault()
                        const didSelect = onSelectPage(page.title)
                        if (didSelect !== false) closeNavOnMobile()
                      }}
                      className={`wiki-nav-link ${currentPageTitle === page.title ? 'active' : ''}`}
                    >
                      <span className="wiki-nav-link-label">{page.title}</span>
                      {isPageReviewRequired(page, sections[page.sectionId]) && (
                        <span
                          className={getReviewIndicatorClassName(page.pendingReviewCount, 'wiki-review-indicator-nav')}
                          title={formatReviewIndicatorTitle(page)}
                          aria-label={formatReviewIndicatorTitle(page)}
                        />
                      )}
                    </a>
                  </li>)}
                  {section.pages.length === 0 && <li className="wiki-nav-empty">No pages yet</li>}
                </ul>}
              </div>
            )
          })}
          {!hasVisiblePages && searchTerm && <div className="wiki-nav-empty">No pages match your search.</div>}
          {visibleSections.length === 0 && !searchTerm && <div className="wiki-nav-empty">No accessible sections</div>}
        </div>
      </div>
    </div>
  </aside>
}

export default function Wiki({ currentUser }) {
  const [pages, setPages] = useState([])
  const [sections, setSections] = useState({})
  const [currentPageTitle, setCurrentPageTitle] = useState('Home')
  const [currentPageData, setCurrentPageData] = useState(null)
  const [viewMode, setViewMode] = useState('read') // read, edit, history, new, admin
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [tick, setTick] = useState(0) // Force update trigger

  useEffect(function loadInitialData() {
    const initData = async () => {
      if (!currentUser?.id) {
        setPages([])
        setSections({})
        setCurrentPageData(null)
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const [loadedPages, loadedSections] = await Promise.all([
          wikiApi.getWikiPages(currentUser.id),
          wikiApi.getWikiSections()
        ])
        const sectionMap = loadedSections.reduce((acc, section) => {
          acc[section.title] = section
          return acc
        }, {})

        setPages(loadedPages)
        setSections(sectionMap)
        setCurrentPageTitle(previousPageTitle => (
          previousPageTitle || (loadedPages[0]?.title || null)
        ))
        setErrorMessage('')
      } catch (error) {
        setErrorMessage(error.message || 'Failed to load wiki data')
      } finally {
        setLoading(false)
      }
    }
    initData()
  }, [currentUser?.id, tick]) // Reload all data on tick or when active user changes

  useEffect(function loadCurrentPageData() {
    const loadPage = async () => {
      if (!currentPageTitle && pages.length > 0) {
        setCurrentPageTitle(pages[0]?.title || null)
        return
      }

      try {
        if (currentPageTitle) {
          const page = await wikiApi.getWikiPage(currentPageTitle, currentUser?.id)
          setCurrentPageData(page)
          setErrorMessage('')
        } else {
          setCurrentPageData(null)
          setErrorMessage('')
        }
      } catch (error) {
        setCurrentPageData(previousPageData => (
          previousPageData?.title === currentPageTitle ? previousPageData : null
        ))
        setErrorMessage(error.message || 'Failed to load the selected page')
      }
    }
    loadPage()
  }, [currentPageTitle, currentUser?.id, pages, tick])

  const currentDraftKey = currentUser
    ? (viewMode === 'edit' && currentPageData?.title
      ? `wiki_draft:${currentPageData.title}`
      : viewMode === 'new'
        ? 'wiki_draft:new_page'
        : null)
    : null

  function clearCurrentDraft() { if (currentDraftKey) localStorage.removeItem(currentDraftKey) }
  function handleSelectPage(title) {
    setErrorMessage('')
    setCurrentPageTitle(title)
    setViewMode('read')
    return true
  }
  function handleCreatePage() {
    setErrorMessage('')
    setCurrentPageTitle(null)
    setViewMode('new')
    return true
  }

  const currentPageContent = currentPageData?.currentRevision?.content || ''

  // Derived state for permissions. Logic: Check section permissions for current page.
  const currentSection = currentPageData ? sections[currentPageData.sectionId] : null
  const canEdit = currentUser && currentSection
    ? hasGroupAccess(currentSection.writeGroups, currentUser)
    : false

  const canDelete = currentUser && currentUser.isAdmin
  const writableSections = Object.values(sections).filter(section => hasGroupAccess(section.writeGroups, currentUser))
  const canCreatePage = writableSections.length > 0
  const canManageSections = Boolean(currentUser?.isAdmin)

  if (loading) return <div className="wiki-container">Loading...</div>

  return (
    <div className="wiki-container">
      <Sidebar
        pages={pages}
        sections={sections}
        currentPageTitle={currentPageTitle}
        onSelectPage={handleSelectPage}
        onCreatePage={handleCreatePage}
        currentUser={currentUser}
        onOpenAdmin={() => {
          if (!canManageSections) return false
          setViewMode('admin')
          return true
        }}
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
            sections={sections}
            pages={pages}
            onUpdate={() => {
              setTick(t => t + 1)
            }}
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
                canApprovePageReview(currentPageData, sections[currentPageData.sectionId], currentUser)
                || currentPageData.pendingRevisions?.some(revision => canApprovePageReview(currentPageData, sections[revision.sectionId], currentUser))
              )
            )}
            currentUser={currentUser}
            onApprove={async (index, revision) => {
              const isOwnRevision = revision?.authorId === currentUser?.id
              const confirmationMessage = isOwnRevision
                ? 'Warning: you are approving your own revision. Continue?'
                : 'Approve this revision?'

              if (window.confirm(confirmationMessage)) {
                try {
                  await wikiApi.approveWikiRevision(currentPageData.title, index, currentUser.id)
                  setTick(t => t + 1)
                } catch (e) { alert(e.message) }
              }
            }}
            onReject={async (index) => {
              if (window.confirm("Reject this revision?")) {
                try {
                  await wikiApi.rejectWikiRevision(currentPageData.title, index, currentUser.id)
                  setTick(t => t + 1)
                } catch (e) { alert(e.message) }
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
            key={`edit:${currentPageData.title}`}
            page={currentPageData}
            initialTitle={currentPageData.title}
            initialContent={currentPageContent}
            initialSectionId={currentPageData.sectionId}
            initialReviewMode={currentPageData.reviewMode}
            sections={writableSections}
            onCancel={() => setViewMode('read')}
            onSave={async (title, content, sectionId, originalTitle) => {
              try {
                const res = await wikiApi.saveWikiPage(title, content, currentUser.id, sectionId, originalTitle)
                if (res.status === 'pending') {
                  alert("Changes submitted for review.")
                }
                clearCurrentDraft()
                setCurrentPageTitle(title.trim())
                setTick(t => t + 1) // Trigger data refresh
                setViewMode('read')
              } catch (e) {
                alert(e.message)
              }
            }}
          />
        )}

        {viewMode === 'new' && (
          <PageEditor
            key="new"
            page={null}
            initialTitle=""
            initialContent=""
            initialSectionId={null}
            initialReviewMode="inherit"
            sections={writableSections}
            onCancel={() => setViewMode('read')}
            onSave={async (title, content, sectionId) => {
              const normalizedTitle = title.trim()
              if (!normalizedTitle) return alert("Please enter a valid title")
              const exists = pages.some(p => p.title.toLowerCase() === normalizedTitle.toLowerCase())
              if (exists) return alert("Page already exists")
              if (!sectionId) return alert("No writable section is available")

              try {
                const res = await wikiApi.saveWikiPage(normalizedTitle, content, currentUser.id, sectionId)
                if (res.status === 'pending') {
                  alert("Page submitted for review.")
                  // Go to home or stay?
                }
                clearCurrentDraft()
                setCurrentPageTitle(normalizedTitle)
                setTick(t => t + 1)
                setViewMode('read')
              } catch (e) {
                alert(e.message)
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
              if (window.confirm(`Are you sure you want to revert to version ${version}?`)) {
                try {
                  await wikiApi.revertWikiPage(currentPageData.title, version, currentUser.id)
                  setTick(t => t + 1)
                  setViewMode('read')
                } catch (e) {
                  alert(e.message)
                }
              }
            }}
          />
        )}
      </main>
    </div>
  )
}
