import React, { useState } from 'react';
import { fetchAPI } from '../utils';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const data = await fetchAPI('/login', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Wiki Login</h2>
        <p>Select a user to continue:</p>
        <div className="login-buttons">
          <button className="btn" onClick={() => setUsername('admin')}>
            Admin (Full Access)
          </button>
          <button className="btn" onClick={() => setUsername('editor')}>
            Editor (Read/Write)
          </button>
          <button className="btn" onClick={() => setUsername('viewer')}>
            Viewer (Read Only)
          </button>
        </div>

        <form onSubmit={handleLogin} style={{ marginTop: '2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
             <strong>Selected: </strong> {username}
          </div>
          <button type="submit" className="btn btn-primary">
            Login
          </button>
        </form>
        {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
      </div>
    </div>
  );
}
