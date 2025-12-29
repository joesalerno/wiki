import React from 'react';
import Wiki from './wiki/Wiki';
import './App.css'; // Optional: keep or remove depending on preference, but Wiki has its own styles

function App() {
  return (
    <div style={{ width: '100%', height: '100vh', margin: 0, padding: 0 }}>
      <Wiki />
    </div>
  );
}

export default App;
