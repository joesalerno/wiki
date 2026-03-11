import { useState } from 'react';
import Wiki from './Wiki';
import './App.css';
import './index.css';

const DIRECTORY_USERS = [
  { id: 'u1', name: 'Alice (Admin)', groups: ['admin', 'wiki_editors'], isAdmin: true },
  { id: 'u2', name: 'Bob (Editor)', groups: ['wiki_editors'], isAdmin: false },
  { id: 'u3', name: 'Charlie (Viewer)', groups: [], isAdmin: false }
];

function App() {
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem('wiki_user_id') || 'u3');

  const currentUser = DIRECTORY_USERS.find(user => user.id === currentUserId) || DIRECTORY_USERS[2];

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
          <span className="app-header-title">Wiki Production Sandbox</span>
        </div>

        <div className="app-header-user-panel">
          <label className="app-header-user-label" htmlFor="app-user-select">Signed in as</label>
          <select
            id="app-user-select"
            className="app-user-select"
            value={currentUserId}
            onChange={(event) => handleSwitchUser(event.target.value)}
          >
            {DIRECTORY_USERS.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
          <div className="app-header-user-meta">
            <span>Role: {currentUser.isAdmin ? 'Admin' : 'Member'}</span>
            <span>Groups: {currentUser.groups.length > 0 ? currentUser.groups.join(', ') : 'None'}</span>
          </div>
        </div>
      </header>

      <div className="app-container">
        <Wiki currentUser={currentUser} />
      </div>
    </div>
  );
}

export default App;
