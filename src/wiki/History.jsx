import React, { useState, useEffect } from 'react';
import { API } from './api';

export default function History({ pageId, navigate, currentUser, canReview, sections, onApprove }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    API.fetchPage(pageId).then(setData);
  }, [pageId]);

  if (!data) return <div className="wiki-content">Loading history...</div>;

  const { page, revisions } = data;
  const section = sections.find(s => s.id === page.sectionId);
  const userCanReview = canReview(page.sectionId);

  const handleApprove = async (revId) => {
      await API.approveRevision(revId);
      const newData = await API.fetchPage(pageId);
      setData(newData);
      onApprove();
  };

  return (
    <>
      <div className="wiki-header">
         <h1 className="wiki-title">History: {page.title}</h1>
         <div className="wiki-actions">
           <button onClick={() => navigate('page', { id: pageId })}>Back to Page</button>
         </div>
      </div>

      <div className="wiki-history-list">
        {revisions.map((rev, index) => {
            const nextRev = revisions[index + 1]; // Older revision
            return (
                <div key={rev.id} className="wiki-revision-item">
                    <div>
                        <strong>Version {rev.version}</strong> by {rev.author} <br/>
                        <span style={{fontSize: '12px', color: '#666'}}>
                            {new Date(rev.timestamp).toLocaleString()}
                        </span>
                        {index < revisions.length - 1 && (
                            <div style={{marginTop: '4px'}}>
                                <a
                                  href="#"
                                  style={{fontSize: '12px', color: 'var(--wiki-accent)'}}
                                  onClick={(e) => {
                                      e.preventDefault();
                                      navigate('diff', { id: pageId, v1: nextRev.version, v2: rev.version });
                                  }}
                                >
                                    Compare with previous
                                </a>
                            </div>
                        )}
                    </div>

                    <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                        <span className={`wiki-status-badge status-${rev.status}`}>
                            {rev.status}
                        </span>

                        {rev.status === 'pending' && userCanReview && (
                            <button
                                className="wiki-btn-primary"
                                style={{fontSize: '11px', padding: '4px 8px'}}
                                onClick={() => handleApprove(rev.id)}
                            >
                                Approve
                            </button>
                        )}
                    </div>
                </div>
            );
        })}
      </div>
    </>
  );
}
