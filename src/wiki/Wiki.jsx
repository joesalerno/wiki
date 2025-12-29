import React, { useState, useEffect } from 'react';
import './Wiki.css';
import { db } from './db';
import Sidebar from './Sidebar';
import PageViewer from './PageViewer';
import PageEditor from './PageEditor';
import HistoryViewer from './HistoryViewer';

export default function Wiki() {
  const [view, setView] = useState('view'); // view, edit, history
  const [currentPageId, setCurrentPageId] = useState(null);
  const [currentSectionId, setCurrentSectionId] = useState(null);
  const [currentUser, setCurrentUser] = useState(db.currentUser);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Initialize with first page if available
  useEffect(() => {
    const pages = db.getPages();
    if (pages.length > 0 && !currentPageId) {
      setTimeout(() => setCurrentPageId(pages[0].id), 0);
    }
  }, [currentPageId]);

  const handlePageSelect = (pageId, sectionId) => {
    if (pageId === 'new') {
      setCurrentSectionId(sectionId);
      setCurrentPageId('new');
      setView('edit');
    } else {
      setCurrentPageId(pageId);
      setView('view');
    }
  };

  const handleUserChange = (userId) => {
    db.setCurrentUser(userId);
    setCurrentUser({ ...db.currentUser });
    setRefreshTrigger(prev => prev + 1); // Force re-render of components relying on permissions
    // Reset view if permission lost
    setView('view');
    setCurrentPageId(null);
  };

  const renderMain = () => {
    if (view === 'edit') {
      return (
        <PageEditor
          pageId={currentPageId}
          sectionId={currentSectionId}
          onCancel={() => setView('view')}
          onSaveSuccess={(id) => {
            setCurrentPageId(id);
            setView('view');
            setRefreshTrigger(prev => prev + 1);
          }}
        />
      );
    }
    if (view === 'history') {
        return (
            <HistoryViewer
                pageId={currentPageId}
                onBack={() => setView('view')}
            />
        );
    }

    if (!currentPageId) return <div className="wiki-content">Select a page or log in.</div>;

    const page = db.getPage(currentPageId);
    // If page permissions deny view, page will be null
    if (!page) return <div className="wiki-content">Access Denied or Page Not Found</div>;

    return (
      <PageViewer
        page={page}
        onEdit={() => setView('edit')}
        onHistory={() => setView('history')}
      />
    );
  };

  return (
    <div className="wiki-container" key={refreshTrigger}>
      <Sidebar
        onSelectPage={handlePageSelect}
        currentSectionId={currentSectionId}
      />
      <div className="wiki-main">
        {renderMain()}

        {/* User Switcher for Demo Purposes */}
        <div className="user-switcher">
            <strong>User: </strong>
            <select
                value={currentUser.id}
                onChange={(e) => handleUserChange(e.target.value)}
                style={{marginLeft: '5px', padding: '2px'}}
            >
                {db.getUsers().map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.groups.join(', ')})</option>
                ))}
            </select>
        </div>
      </div>
    </div>
  );
}
