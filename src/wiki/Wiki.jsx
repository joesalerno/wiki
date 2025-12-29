import React, { useState, useEffect } from 'react';
import './wiki.css';
import { API } from './api';
import Sidebar from './Sidebar';
import PageViewer from './PageViewer';
import PageEditor from './PageEditor';
import History from './History';
import Diff from './Diff';

export default function Wiki({ currentUser }) {
  const [data, setData] = useState({ groups: {}, sections: [], pages: [] });
  const [loading, setLoading] = useState(true);

  // Router State: { view: 'page' | 'edit' | 'history' | 'diff', params: {} }
  const [route, setRoute] = useState({ view: 'home', params: {} });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const initData = await API.fetchInit();
      setData(initData);

      // Default route if at home
      if (route.view === 'home' && initData.pages.length > 0) {
        setRoute({ view: 'page', params: { id: initData.pages[0].id } });
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const navigate = (view, params = {}) => {
    setRoute({ view, params });
  };

  // Helper: check if user is in group
  const isUserInGroup = (groupName) => {
    if (!currentUser) return false;
    // Special case for 'everyone' implicitly? or check db
    const members = data.groups[groupName] || [];
    return members.includes(currentUser);
  };

  const canWrite = (sectionId) => {
    const section = data.sections.find(s => s.id === sectionId);
    if (!section) return false;
    return section.permissions.write.some(g => isUserInGroup(g));
  };

  const canReview = (sectionId) => {
    const section = data.sections.find(s => s.id === sectionId);
    if (!section) return false;
    return section.permissions.review.some(g => isUserInGroup(g));
  };

  if (loading) return <div className="wiki-loading">Loading Wiki...</div>;

  return (
    <div className="wiki-container">
      <Sidebar
        data={data}
        route={route}
        navigate={navigate}
        canWrite={canWrite}
        currentUser={currentUser}
      />

      <div className="wiki-main">
        {route.view === 'page' && (
          <PageViewer
            pageId={route.params.id}
            navigate={navigate}
            currentUser={currentUser}
            canWrite={canWrite}
            canReview={canReview}
            sections={data.sections} // Pass sections to lookup permissions
          />
        )}

        {route.view === 'edit' && (
          <PageEditor
            pageId={route.params.id} // null if new
            sectionId={route.params.sectionId}
            navigate={navigate}
            currentUser={currentUser}
            onSave={loadData}
            sections={data.sections}
          />
        )}

        {route.view === 'history' && (
          <History
             pageId={route.params.id}
             navigate={navigate}
             currentUser={currentUser}
             canReview={canReview}
             sections={data.sections}
             onApprove={() => { loadData(); /* reload to update badges */ }}
          />
        )}

        {route.view === 'diff' && (
            <Diff
                pageId={route.params.id}
                v1={route.params.v1}
                v2={route.params.v2}
                navigate={navigate}
            />
        )}
      </div>
    </div>
  );
}
