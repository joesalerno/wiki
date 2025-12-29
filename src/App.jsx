import { useState } from 'react'
import Wiki from './wiki/Wiki'
import './App.css'

function App() {
  const [user, setUser] = useState('admin');

  return (
    <div style={{height: '100vh', display: 'flex', flexDirection: 'column'}}>
      <div style={{
        padding: '10px 20px',
        background: '#333',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{fontWeight: 'bold'}}>React Wiki Component Demo</div>
        <div>
          <label style={{marginRight: '10px', fontSize: '14px'}}>Simulate User:</label>
          <select value={user} onChange={(e) => setUser(e.target.value)} style={{padding: '4px'}}>
            <option value="admin">Admin (Full Access)</option>
            <option value="alice">Alice (Editor)</option>
            <option value="bob">Bob (Viewer)</option>
          </select>
        </div>
      </div>

      <div style={{flex: 1, overflow: 'hidden'}}>
        <Wiki currentUser={user} />
      </div>
    </div>
  )
}

export default App
