import React, { useState } from 'react';

export default function Sidebar({ data, route, navigate, canWrite, currentUser }) {
  const [search, setSearch] = useState('');

  const filteredSections = data.sections.map(section => {
    const pages = data.pages.filter(p => p.sectionId === section.id);
    const filteredPages = pages.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));

    if (search && filteredPages.length === 0) return null;

    return {
      ...section,
      pages: search ? filteredPages : pages
    };
  }).filter(Boolean);

  return (
    <div className="wiki-sidebar">
      <div className="wiki-search">
        <input
          type="text"
          placeholder="Search pages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredSections.map(section => (
        <div key={section.id} className="wiki-section">
          <div className="wiki-section-title">
            {section.title}
            {canWrite(section.id) && (
               <span
                 className="wiki-add-page"
                 style={{float: 'right'}}
                 onClick={() => navigate('edit', { sectionId: section.id })}
               >
                 + Add
               </span>
            )}
          </div>

          {section.pages.map(page => (
            <a
              key={page.id}
              className={`wiki-page-link ${route.view === 'page' && route.params.id === page.id ? 'active' : ''}`}
              onClick={() => navigate('page', { id: page.id })}
            >
              {page.title}
            </a>
          ))}

          {section.pages.length === 0 && (
            <div style={{fontSize: '12px', color: '#999', paddingLeft: '8px'}}>No pages</div>
          )}
        </div>
      ))}

      <div style={{marginTop: 'auto', paddingTop: '20px', fontSize: '12px', borderTop: '1px solid #eee'}}>
        Logged in as: <strong>{currentUser || 'Guest'}</strong>
      </div>
    </div>
  );
}
