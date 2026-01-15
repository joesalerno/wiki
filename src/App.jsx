import React, { useState, useEffect } from 'react';
import Wiki from './Wiki';
import { db } from './db';
import './index.css';

function App() {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [pages, setPages] = useState([]);
  const [sections, setSections] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [loadedUsers, loadedGroups, loadedPages, loadedSections] = await Promise.all([
         db.getUsers(),
         db.getGroups(),
         db.getPages(),
         db.getSections()
      ]);
      setUsers(loadedUsers);
      setGroups(loadedGroups);
      setPages(loadedPages);
      setSections(loadedSections);

      // Handle User Session Logic (Simulation)
      if (!currentUser) {
          const storedId = localStorage.getItem('wiki_user_id');
          let initialUser = null;
          if (storedId) initialUser = loadedUsers.find(u => u.id === storedId);
          if (!initialUser) initialUser = loadedUsers[0];

          if (initialUser) {
              setCurrentUser(initialUser);
              localStorage.setItem('wiki_user_id', initialUser.id);
          }
      }
      setLoading(false);
    } catch (e) {
      console.error("Failed to load data", e);
      setLoading(false);
    }
  };

  // Initial Data Load
  useEffect(() => {
    db.init().then(fetchData);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwitchUser = (userId) => {
    const user = users.find(u => u.id === userId);
    if (user) {
        setCurrentUser(user);
        localStorage.setItem('wiki_user_id', userId);
        // Refresh pages because permissions might change what is returned (though db.getPages might not filter server side currently, it's good practice)
        // db.getPages uses localStorage internally in the original code, but we should probably just rely on state here.
        // If we want to be pure, we should pass user to db calls, but db.js is relying on localStorage.
        // Since we update localStorage above, subsequent db calls will use the new user.
    }
  };

  // Wrapper functions for Wiki interactions

  const handleFetchPage = async (slug) => {
    return await db.getPage(slug);
  };

  const handleSavePage = async (slug, title, content, sectionId) => {
    const result = await db.savePage(slug, title, content, currentUser, sectionId);
    await fetchData(); // Refresh list of pages
    return result;
  };

  const handleHistory = async (slug) => {
    return await db.getHistory(slug);
  };

  const handleRevert = async (slug, version) => {
    const result = await db.revert(slug, version, currentUser);
    await fetchData(); // Content changed
    return result;
  };

  const handleApprove = async (slug, index) => {
    const result = await db.approveRevision(slug, index, currentUser);
    await fetchData();
    return result;
  };

  const handleReject = async (slug, index) => {
    const result = await db.rejectRevision(slug, index, currentUser);
    await fetchData();
    return result;
  };

  const handleSaveSection = async (section) => {
      if (sections[section.id]) {
          await db.updateSection(section.id, section);
      } else {
          await db.createSection(section.id, section);
      }
      await fetchData();
  };

  const handleDeleteSection = async (id) => {
      await db.deleteSection(id);
      await fetchData();
  };

  if (loading) return <div>Loading Application...</div>;

  return (
    <div className="app-container">
       <div style={{padding: '0.5rem', background: '#eee', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem'}}>
          <span>App User Switcher (Simulation): </span>
          <select
            value={currentUser?.id || ''}
            onChange={(e) => handleSwitchUser(e.target.value)}
          >
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
       </div>

      <Wiki
        currentUser={currentUser}
        pages={pages}
        sections={sections}
        groups={groups} // Needed for Section settings dropdowns

        onFetchPage={handleFetchPage}
        onSavePage={handleSavePage}

        onFetchHistory={handleHistory}
        onRevert={handleRevert}

        onApprove={handleApprove}
        onReject={handleReject}

        onSaveSection={handleSaveSection}
        onDeleteSection={handleDeleteSection}
      />
    </div>
  );
}

export default App;
