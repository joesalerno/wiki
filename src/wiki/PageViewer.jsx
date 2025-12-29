import React, { useState, useEffect } from 'react';
import { API } from './api';

// Simple parser for minimal formatting
const parseContent = (text) => {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    // Headers
    if (line.startsWith('# ')) return <h1 key={i}>{line.slice(2)}</h1>;
    if (line.startsWith('## ')) return <h2 key={i}>{line.slice(3)}</h2>;
    if (line.startsWith('### ')) return <h3 key={i}>{line.slice(4)}</h3>;

    // Lists
    if (line.startsWith('- ')) return <ul key={i}><li>{line.slice(2)}</li></ul>;

    // Bold (Simple regex)
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const content = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    if (line.trim() === '') return <br key={i} />;

    return <p key={i}>{content}</p>;
  });
};

export default function PageViewer({ pageId, navigate, currentUser, canWrite, canReview, sections }) {
  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPage();
  }, [pageId]);

  const fetchPage = async () => {
    setLoading(true);
    try {
      const res = await API.fetchPage(pageId);
      setPageData(res);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  if (loading) return <div className="wiki-content">Loading...</div>;
  if (!pageData || !pageData.page) return <div className="wiki-content">Page not found</div>;

  const { page, revisions } = pageData;
  // If page.latestVersion is 0, it means no published version exists.
  // We should only fall back to revisions[0] if the user is allowed to see pending changes (e.g. editor/admin/reviewer).
  // But strictly, viewers should see "No content" or "Draft" message if no published version.

  const section = sections.find(s => s.id === page.sectionId);
  const userCanEdit = canWrite(page.sectionId);
  const userCanReview = canReview(page.sectionId);
  const canViewPending = userCanEdit || userCanReview;

  let latestRevision = revisions.find(r => r.version === page.latestVersion);

  if (!latestRevision) {
      // No published version found (e.g. new page that is pending)
      if (canViewPending && revisions.length > 0) {
          latestRevision = revisions[0]; // Show the pending draft to authors
      }
  }

  // Find if there are newer pending revisions
  const pendingRevision = revisions.find(r => r.status === 'pending');

  return (
    <>
      <div className="wiki-header">
        <div>
          <h1 className="wiki-title">{page.title}</h1>
          <div className="wiki-meta">
            Section: {section?.title} | Version: {latestRevision?.version} | Last updated: {new Date(latestRevision?.timestamp).toLocaleString()}
            {pendingRevision && <span style={{color: 'orange', marginLeft: '10px'}}> (Pending updates available)</span>}
          </div>
        </div>
        <div className="wiki-actions">
           <button onClick={() => navigate('history', { id: page.id })}>History</button>
           {userCanEdit && (
             <button className="wiki-btn-primary" onClick={() => navigate('edit', { id: page.id, sectionId: page.sectionId })}>
               Edit
             </button>
           )}
        </div>
      </div>

      <div className="wiki-content">
        {parseContent(latestRevision?.content)}
      </div>
    </>
  );
}
