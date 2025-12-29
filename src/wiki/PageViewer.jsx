import React from 'react';
import { db } from './db';

// Simple "Markdown-like" parser to avoid dependencies
const renderContent = (text) => {
  if (!text) return null;
  return text.split('\n').map((line, index) => {
    if (line.startsWith('# ')) return <h1 key={index}>{line.slice(2)}</h1>;
    if (line.startsWith('## ')) return <h2 key={index}>{line.slice(3)}</h2>;
    if (line.startsWith('### ')) return <h3 key={index}>{line.slice(4)}</h3>;
    if (line.startsWith('- ')) return <li key={index}>{line.slice(2)}</li>;
    if (line.trim() === '') return <br key={index} />;
    return <p key={index}>{line}</p>;
  });
};

export default function PageViewer({ page, onEdit, onHistory }) {
  if (!page) return <div className="wiki-content">Select a page to view</div>;

  const canEdit = db.checkPermission(page.sectionId, 'edit');
  const section = db.getSections().find(s => s.id === page.sectionId);

  return (
    <div className="wiki-main-container">
        <header className="wiki-header">
            <h1 className="wiki-title">
                {page.title}
                <span style={{fontSize: '0.8rem', fontWeight: 'normal', color: '#666', marginLeft: '10px'}}>
                    (v{page.currentVersion})
                </span>
            </h1>
            <div className="wiki-actions">
                <span style={{marginRight: '1rem', fontSize: '0.9rem', color: '#888'}}>
                    Section: {section?.name}
                </span>
                <button className="btn btn-secondary" onClick={() => onHistory(page.id)}>History</button>
                {canEdit && <button className="btn btn-primary" onClick={() => onEdit(page.id)}>Edit</button>}
            </div>
        </header>
        <div className="wiki-content">
            {renderContent(page.content)}
        </div>
        {page.status === 'pending_review' && (
             <div style={{padding: '1rem', background: '#fff3cd', borderTop: '1px solid #ffeeba'}}>
                 ⚠️ There is a pending draft for this page waiting for review.
             </div>
        )}
    </div>
  );
}
