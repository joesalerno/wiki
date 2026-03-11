import { useEffect, useState } from 'react';
import Wiki from './Wiki';
import { wikiApi } from './wikiApi';
import './App.css';
import './index.css';

const ADMIN_GROUPS = new Set(['admin', 'wiki_admin']);

export default function App() {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem('wiki_user_id') || 'u3');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [fetchedUsers, fetchedGroups] = await Promise.all([wikiApi.getUsers(), wikiApi.getGroups()]);

        const combinedUsers = fetchedUsers.map(u => {
          const userGroups = fetchedGroups.filter(g => g.users.some(gu => gu.id === u.id)).map(g => g.name);
          return { ...u, groups: userGroups, isAdmin: userGroups.some(g => ADMIN_GROUPS.has(g)) };
        });

        setUsers(combinedUsers);
        setError('');

        // Use a functional update to check against the latest currentUserId
        setCurrentUserId((prevId) => {
          if (!combinedUsers.find(u => u.id === prevId) && combinedUsers.length) {
            return combinedUsers[0].id;
          }
          return prevId;
        });

      } catch (e) {
        setError(e.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const switchUser = (id) => {
    setCurrentUserId(id);
    id ? localStorage.setItem('wiki_user_id', id) : localStorage.removeItem('wiki_user_id');
  };

  const currentUser = users.find(u => u.id === currentUserId) || null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-brand"><span className="app-header-title">Wiki</span></div>
        <div className="app-header-user-panel">
          <label className="app-header-user-label" htmlFor="app-user-select">Signed in as</label>
          <select
            id="app-user-select" className="app-user-select" value={currentUserId}
            onChange={(e) => switchUser(e.target.value)} disabled={loading || !users.length}
          >
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <div className="app-header-user-meta">
            <span>Role: {currentUser?.isAdmin ? 'Admin' : 'Member'}</span>
            <span>Groups: {currentUser?.groups?.join(', ') || 'None'}</span>
          </div>
        </div>
      </header>

      <div className="app-container">
        {error && (
          <div className="app-banner app-banner-error">
            <span>{error}</span><button className="app-banner-action" onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}
        {!loading && currentUser && <Wiki currentUser={currentUser} />}
        {!loading && !currentUser && !error && (
          <div className="app-empty-state"><h2>No users available</h2><p>Add a user to continue.</p></div>
        )}
        {loading && !error && <div className="app-empty-state"><h2>Loading wiki</h2></div>}
      </div>
    </div>
  );
}
