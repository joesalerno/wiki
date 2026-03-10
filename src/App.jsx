import { useCallback, useEffect, useState } from 'react';
import Wiki from './Wiki';
import { wikiApi } from './wikiApi';
import './App.css';
import './index.css';

const ADMIN_GROUPS = new Set(['admin', 'wiki_admin']);

function getUserGroups(groups, userId) {
  return Object.values(groups || {})
    .filter(group => (group.memberIds || []).includes(userId))
    .map(group => group.name);
}

function normalizeGroups(groups) {
  return Object.fromEntries(
    (groups || []).map(group => {
      const memberIds = (group.users || []).map(user => user.id);
      return [group.name, { ...group, memberIds }];
    })
  );
}

function buildUsersWithGroups(users, groups) {
  return users.map(user => {
    const memberships = getUserGroups(groups, user.id);
    return {
      ...user,
      groups: memberships,
      isAdmin: memberships.some(groupName => ADMIN_GROUPS.has(groupName))
    };
  });
}

function formatGroups(items) {
  return items && items.length > 0 ? items.join(', ') : 'None';
}

function App() {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState({});
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem('wiki_user_id') || 'u3');
  const [isIdentityLoading, setIsIdentityLoading] = useState(true);
  const [identityError, setIdentityError] = useState('');

  const directoryUsers = buildUsersWithGroups(users, groups);
  const selectedDirectoryUser = directoryUsers.find(user => user.id === currentUserId) || null;
  const currentUserGroups = getUserGroups(groups, currentUserId);
  const currentUser = currentUserId
    ? {
        id: currentUserId,
        name: selectedDirectoryUser?.name || currentUserId,
        groups: currentUserGroups,
        isAdmin: currentUserGroups.some(groupName => ADMIN_GROUPS.has(groupName))
      }
    : null;
  const selectableUsers = directoryUsers.length > 0
    ? directoryUsers
    : (currentUser ? [currentUser] : []);

  const loadIdentityData = useCallback(async (preferredUserId) => {
    try {
      setIsIdentityLoading(true);

      const [loadedUsers, loadedGroups] = await Promise.all([
        wikiApi.getWikiUsers(),
        wikiApi.getWikiGroups()
      ]);

      const groupMap = normalizeGroups(loadedGroups);
      const usersWithGroups = buildUsersWithGroups(loadedUsers, groupMap);
      const storedUserId = localStorage.getItem('wiki_user_id');
      const nextUserId = [preferredUserId, currentUserId, storedUserId]
        .find(userId => userId && usersWithGroups.some(user => user.id === userId))
        || usersWithGroups[0]?.id
        || '';

      setUsers(usersWithGroups);
      setGroups(groupMap);
      setCurrentUserId(nextUserId);
      setIdentityError('');

      if (nextUserId) {
        localStorage.setItem('wiki_user_id', nextUserId);
      } else {
        localStorage.removeItem('wiki_user_id');
      }
    } catch (error) {
      setIdentityError(error.message || 'Failed to load wiki users');
    } finally {
      setIsIdentityLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadIdentityData();
  }, [loadIdentityData]);

  const handleSwitchUser = (userId) => {
    setCurrentUserId(userId);
    if (userId) {
      localStorage.setItem('wiki_user_id', userId);
    } else {
      localStorage.removeItem('wiki_user_id');
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-brand">
          <span className="app-header-title">Wiki</span>
        </div>

        <div className="app-header-user-panel">
          <label className="app-header-user-label" htmlFor="app-user-select">Signed in as</label>
          <select
            id="app-user-select"
            className="app-user-select"
            value={currentUserId}
            onChange={(event) => handleSwitchUser(event.target.value)}
            disabled={isIdentityLoading || selectableUsers.length === 0}
          >
            {selectableUsers.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
          <div className="app-header-user-meta">
            <span>Role: {currentUser?.isAdmin ? 'Admin' : 'Member'}</span>
            <span>Groups: {formatGroups(currentUser?.groups || [])}</span>
          </div>
        </div>
      </header>

      <div className="app-container">
        {identityError && (
          <div className="app-banner app-banner-error">
            <span>{identityError}</span>
            <button className="app-banner-action" onClick={() => loadIdentityData(currentUserId)}>
              Retry
            </button>
          </div>
        )}

        {!isIdentityLoading && currentUser && (
          <Wiki
            currentUser={currentUser}
          />
        )}

        {!isIdentityLoading && !currentUser && !identityError && (
          <div className="app-empty-state">
            <h2>No wiki user available</h2>
            <p>Add a wiki user to continue.</p>
          </div>
        )}

        {isIdentityLoading && !identityError && (
          <div className="app-empty-state">
            <h2>Loading wiki</h2>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
