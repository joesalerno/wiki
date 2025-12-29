import React, { useState, useEffect } from 'react';
import { db } from './db';
import { computeDiff } from './diff';

export default function HistoryViewer({ pageId, onBack }) {
  const [history, setHistory] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [compareVersion, setCompareVersion] = useState(null);
  const [page, setPage] = useState(null);

  useEffect(() => {
    setHistory(db.getHistory(pageId));
    setPage(db.getPage(pageId)); // Note: this gets current version, we might need basic metadata
  }, [pageId]);

  if (!page) return <div>Loading...</div>;

  const handleCompare = (v1, v2) => {
    // Show diff
    // v1 is older (usually), v2 is newer
    return (
        <div className="wiki-diff-view" style={{marginTop: '1rem', border: '1px solid #ddd', padding: '1rem', background: '#fff'}}>
            <h3>Changes between v{v1.versionNumber} and v{v2.versionNumber}</h3>
            <div style={{fontFamily: 'monospace', whiteSpace: 'pre-wrap'}}>
                {computeDiff(v1.content, v2.content).map((part, idx) => {
                    if (part.type === 'same') return <div key={idx} style={{color: '#999'}}>{'  ' + part.content}</div>;
                    if (part.type === 'added') return <div key={idx} className="diff-added">{'+ ' + part.content}</div>;
                    if (part.type === 'removed') return <div key={idx} className="diff-removed">{'- ' + part.content}</div>;
                    return null;
                })}
            </div>
        </div>
    );
  };

  return (
    <div className="wiki-main-container">
        <header className="wiki-header">
            <h1 className="wiki-title">History: {page.title}</h1>
            <div className="wiki-actions">
                <button className="btn btn-secondary" onClick={onBack}>Back to Page</button>
            </div>
        </header>
        <div className="wiki-content">
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead>
                    <tr style={{textAlign: 'left', borderBottom: '2px solid #ddd'}}>
                        <th style={{padding: '8px'}}>Ver</th>
                        <th style={{padding: '8px'}}>Date</th>
                        <th style={{padding: '8px'}}>Author</th>
                        <th style={{padding: '8px'}}>Status</th>
                        <th style={{padding: '8px'}}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {history.map(v => (
                        <tr key={v.id} style={{borderBottom: '1px solid #eee'}}>
                            <td style={{padding: '8px'}}>{v.versionNumber}</td>
                            <td style={{padding: '8px'}}>{new Date(v.timestamp).toLocaleString()}</td>
                            <td style={{padding: '8px'}}>{db.getUsers().find(u => u.id === v.authorId)?.name || v.authorId}</td>
                            <td style={{padding: '8px'}}>
                                <span style={{
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    background: v.status === 'published' ? '#d4edda' : '#fff3cd',
                                    color: v.status === 'published' ? '#155724' : '#856404'
                                }}>
                                    {v.status}
                                </span>
                            </td>
                            <td style={{padding: '8px'}}>
                                <button className="btn btn-secondary" style={{fontSize: '0.8rem', marginRight: '5px'}} onClick={() => setSelectedVersion(v)}>View</button>
                                {selectedVersion && selectedVersion.id !== v.id && (
                                    <button className="btn btn-secondary" style={{fontSize: '0.8rem'}} onClick={() => setCompareVersion(v)}>Compare with View</button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {selectedVersion && !compareVersion && (
                <div style={{marginTop: '2rem', border: '1px solid #ccc', padding: '1rem'}}>
                    <h3>Viewing Version {selectedVersion.versionNumber}</h3>
                    <pre style={{whiteSpace: 'pre-wrap', fontFamily: 'sans-serif'}}>{selectedVersion.content}</pre>
                </div>
            )}

            {selectedVersion && compareVersion && handleCompare(compareVersion, selectedVersion)}
        </div>
    </div>
  );
}
