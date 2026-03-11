import { useEffect, useState } from 'react';
import Wiki from './Wiki';
import { wikiApi } from './wikiApi';
import './App.css';
import './index.css';

const ADMIN_GROUPS = new Set(['admin', 'wiki_admin']);

export default function App() {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem('wiki_user_id') || 'u3');
  const [error, setError] = useState('');

  const handleSwitchUser = (id) => {
    setCurrentUserId(id);
    id ? localStorage.setItem('wiki_user_id', id) : localStorage.removeItem('wiki_user_id');
  };

  const loadData = async () => {
    try {
      const [u, g] = await Promise.all([wikiApi.getUsers(), wikiApi.getGroups()]);
      const groupMap = Object.fromEntries(g.map(grp => [grp.name, grp.users.map(user => user.id)]));
      const directory = u.map(user => {
        const groups = Object.keys(groupMap).filter(name => groupMap[name].includes(user.id));
        return { ...user, groups, isAdmin: groups.some(name => ADMIN_GROUPS.has(name)) };
      });
      setUsers(directory);
      if (!directory.some(u => u.id === currentUserId) && directory.length > 0) {
        handleSwitchUser(directory[0].id);
      }
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load data');
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, []);


  const currentUser = users.find(u => u.id === currentUserId);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-brand"><span className="app-header-title">Wiki</span></div>
        <div className="app-header-user-panel">
          <label className="app-header-user-label" htmlFor="app-user-select">Signed in as</label>
          <select id="app-user-select" className="app-user-select" value={currentUserId} onChange={e => handleSwitchUser(e.target.value)} disabled={users.length === 0}>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <div className="app-header-user-meta">
            <span>Role: {currentUser?.isAdmin ? 'Admin' : 'Member'}</span>
            <span>Groups: {currentUser?.groups?.join(', ') || 'None'}</span>
          </div>
        </div>
      </header>

      <div className="app-container">
        {error ? (
          <div className="app-banner app-banner-error">
            <span>{error}</span><button className="app-banner-action" onClick={loadData}>Retry</button>
          </div>
        ) : users.length === 0 ? (
          <div className="app-empty-state"><h2>Loading wiki</h2></div>
        ) : currentUser ? (
          <Wiki currentUser={currentUser} />
        ) : (
          <div className="app-empty-state"><h2>No wiki user available</h2><p>Add a wiki user to continue.</p></div>
        )}
      </div>
    </div>
  );
}
