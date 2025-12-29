import React, { useEffect, useState } from 'react';
import { fetchAPI, formatDate } from '../utils';

export default function PageList({ onNavigate }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAPI('/pages')
      .then(setPages)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading pages...</div>;

  return (
    <ul className="wiki-nav">
      {pages.map((page) => (
        <li key={page.slug}>
          <button onClick={() => onNavigate(page.slug)}>
            <div><strong>{page.title}</strong></div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              Last updated: {formatDate(page.updatedAt)} by {page.updatedBy}
            </div>
          </button>
        </li>
      ))}
       {pages.length === 0 && <li>No pages found.</li>}
    </ul>
  );
}
