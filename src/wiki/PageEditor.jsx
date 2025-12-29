import React, { useState, useEffect } from 'react';
import { API } from './api';

export default function PageEditor({ pageId, sectionId, navigate, currentUser, onSave, sections }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(!!pageId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pageId) {
      loadPage();
    } else {
        // New page
        setLoading(false);
    }
  }, [pageId]);

  const loadPage = async () => {
    try {
      const res = await API.fetchPage(pageId);
      setTitle(res.page.title);
      // Load content from latest revision (or pending if I'm the author? For now just latest published or any latest)
      // Usually editors want to edit the HEAD.
      const head = res.revisions[0];
      setContent(head.content);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);

    // Check if review needed
    const section = sections.find(s => s.id === sectionId);
    const reviewRequired = section?.reviewRequired;
    const status = reviewRequired ? 'pending' : 'published';

    try {
      const result = await API.savePage({
        id: pageId, // if null, backend creates new
        sectionId,
        title,
        content,
        author: currentUser,
        status
      });
      onSave(); // Reload sidebar data

      if (result && result.page) {
          navigate('page', { id: result.page.id });
      } else if (pageId) {
          navigate('page', { id: pageId });
      } else {
           navigate('home');
      }
    } catch (e) {
      alert('Error saving page');
      setSaving(false);
    }
  };

  if (loading) return <div className="wiki-content">Loading editor...</div>;

  return (
    <div className="wiki-editor">
      <input
        type="text"
        placeholder="Page Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        placeholder="Write your content here... Use markdown-like syntax (# Header, **bold**, - list)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      <div className="wiki-editor-actions">
        <button onClick={() => pageId ? navigate('page', { id: pageId }) : navigate('home')}>Cancel</button>
        <button className="wiki-btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Page'}
        </button>
      </div>
    </div>
  );
}
