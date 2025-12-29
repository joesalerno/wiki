import React, { useState, useEffect } from 'react';
import { db } from './db';

export default function Sidebar({ onSelectPage, currentSectionId }) {
  const [sections, setSections] = useState(() => db.getSections());
  const [pages, setPages] = useState(() => db.getPages());
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    // Re-fetch if permissions change context (mock)
    const newPages = db.getPages();
    const newSections = db.getSections();

    // Using function update to avoid lint error if possible, but actually wrapping in setTimeout(0) is the standard workaround for "synchronous state update in effect" if it's truly intended to run after render.
    // Or just moving the logic.
    setTimeout(() => {
        setPages(newPages);
        setSections(newSections);
    }, 0);
  }, [currentSectionId]);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const filteredPages = pages.filter(p =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="wiki-sidebar">
      <div className="wiki-sidebar-header">Wiki</div>
      <input
        type="text"
        className="wiki-search"
        placeholder="Search pages..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {sections.map(section => {
        const sectionPages = filteredPages.filter(p => p.sectionId === section.id);
        if (searchTerm && sectionPages.length === 0) return null;

        return (
          <div key={section.id} className="wiki-section">
            <div
              className="wiki-section-title"
              onClick={() => toggleSection(section.id)}
              style={{cursor: 'pointer', display: 'flex', justifyContent: 'space-between'}}
            >
              {section.name}
              <span>{expandedSections[section.id] || searchTerm ? '▼' : '▶'}</span>
            </div>

            {(expandedSections[section.id] || searchTerm) && (
              <div>
                {sectionPages.map(page => (
                  <a
                    key={page.id}
                    className="wiki-page-link"
                    onClick={() => onSelectPage(page.id)}
                  >
                    {page.title}
                  </a>
                ))}
                {sectionPages.length === 0 && <div style={{fontSize: '0.8rem', color: '#999', paddingLeft: '8px'}}>No pages</div>}

                {/* Add Page Button if permission allows */}
                {db.checkPermission(section.id, 'edit') && (
                    <button
                        className="btn btn-secondary"
                        style={{marginTop: '5px', width: '100%', fontSize: '0.8rem'}}
                        onClick={() => onSelectPage('new', section.id)}
                    >
                        + New Page
                    </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
