import Wiki from './Wiki';
import './App.css';
import './index.css';

function App() {
  const currentUser = {
    id: 'u1',
    name: 'Alice (Admin)',
    groups: ['admin', 'wiki_editors'],
    isAdmin: true
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-brand">
          <span className="app-header-title">Wiki Production Sandbox</span>
        </div>
      </header>
      <div className="app-container">
        <Wiki currentUser={currentUser} />
      </div>
    </div>
  );
}

export default App;
