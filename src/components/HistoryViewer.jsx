import React, { useEffect, useState } from 'react';
import { fetchAPI, formatDate } from '../utils';

export default function HistoryViewer({ slug, currentVersion, onViewVersion, onBack }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAPI(`/pages/${slug}/history`)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div>Loading history...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>History: {slug}</h2>
        <button className="btn" onClick={onBack}>Back to Page</button>
      </div>

      <ul className="history-list">
        {history.map((item) => (
          <li key={item.version} className="history-item">
            <div>
              <span className="version-badge">v{item.version}</span>
              <span style={{ marginLeft: '1rem' }}>
                Edited by <strong>{item.author}</strong>
              </span>
            </div>
            <div>
              <span style={{ marginRight: '1rem', color: '#6b7280' }}>
                {formatDate(item.timestamp)}
              </span>
              {item.version !== currentVersion ? (
                 <button className="btn" onClick={() => onViewVersion(item.version)}>
                   View
                 </button>
              ) : (
                <span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>Current</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
