import React, { useState } from 'react';
import { db } from './db';

export default function PageEditor({ pageId, sectionId, onCancel, onSaveSuccess }) {
  const isNew = pageId === 'new';
  const existingPage = !isNew ? db.getPage(pageId) : null;

  const [title, setTitle] = useState(existingPage ? existingPage.title : '');
  const [content, setContent] = useState(existingPage ? existingPage.content : '');
  const [error, setError] = useState(null);

  const handleSave = () => {
    setError(null);
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required.');
      return;
    }

    let result;
    if (isNew) {
      result = db.createPage(sectionId, title, content);
    } else {
      result = db.savePage(pageId, content, title);
    }

    if (result.error) {
      setError(result.error);
    } else {
      onSaveSuccess(result.page ? result.page.id : pageId);
    }
  };

  return (
    <div className="wiki-main-container">
        <header className="wiki-header">
            <h1 className="wiki-title">{isNew ? 'New Page' : `Editing: ${title}`}</h1>
            <div className="wiki-actions">
                <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                <button className="btn btn-success" onClick={handleSave}>Save</button>
            </div>
        </header>
        <div style={{padding: '1rem', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden'}}>
            {error && <div style={{padding: '0.5rem', background: '#f8d7da', color: '#721c24', marginBottom: '1rem', borderRadius: '4px'}}>{error}</div>}

            <input
                type="text"
                placeholder="Page Title"
                className="wiki-search"
                style={{fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem'}}
                value={title}
                onChange={e => setTitle(e.target.value)}
            />

            <textarea
                className="wiki-editor-textarea"
                placeholder="# Markdown Content..."
                value={content}
                onChange={e => setContent(e.target.value)}
            />
            <div style={{marginTop: '0.5rem', fontSize: '0.8rem', color: '#666'}}>
                Simple formatting supported: # for Headers, - for lists.
            </div>
        </div>
    </div>
  );
}
