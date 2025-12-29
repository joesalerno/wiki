import React, { useState, useEffect } from 'react';
import { fetchAPI } from '../utils';

export default function PageEditor({ slug, initialData, onSave, onCancel, user }) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [isNew, setIsNew] = useState(!slug);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!title || !content) {
        setError('Title and content are required');
        return;
    }

    try {
      const newSlug = isNew ? title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '') : slug;

      const payload = {
          title,
          content,
          author: user.username,
          ...(isNew && { slug: newSlug })
      };

      await fetchAPI(isNew ? '/pages' : `/pages/${slug}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onSave(newSlug);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>{isNew ? 'Create New Page' : `Editing: ${initialData?.title}`}</h2>
      </div>

      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          disabled={!isNew && slug !== undefined} // Minimal: only allow title edit on creation for simplicity, or allow both. Let's allow title edit always in backend but let's see. My backend allows title update.
        />
        {!isNew && <small>Note: Changing title does not change the slug (URL).</small>}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Content (Markdown)</label>
        <textarea
          className="editor-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      <div className="editor-actions">
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave}>Save Page</button>
      </div>
    </div>
  );
}
