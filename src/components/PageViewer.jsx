import React, { useEffect, useState } from 'react';
import { fetchAPI, parseMarkdown, formatDate } from '../utils';

export default function PageViewer({ slug, user, onEdit, onHistory, version = null }) {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const endpoint = version ? `/pages/${slug}/version/${version}` : `/pages/${slug}`;
    fetchAPI(endpoint)
      .then(setPage)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug, version]);

  if (loading) return <div>Loading page...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (!page) return <div>Page not found</div>;

  const canEdit = user.permissions.includes('write');

  return (
    <div>
      <div className="page-header">
        <div>
           <h1>{page.title}</h1>
           <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
             Version {page.version} &bull; Updated {formatDate(page.timestamp)} by {page.author}
           </div>
        </div>
        <div className="page-actions">
           {version && (
               <div style={{ marginRight: '1rem', color: 'orange', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                   Viewing Old Version
               </div>
           )}
          <button className="btn" onClick={onHistory}>History</button>
          {canEdit && !version && (
             <button className="btn btn-primary" onClick={() => onEdit(page)}>Edit</button>
          )}
        </div>
      </div>

      <div
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: parseMarkdown(page.content) }}
      />
    </div>
  );
}
