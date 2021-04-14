import React, {useState} from 'react';
import logo from './logo.svg';
import './App.css';
import * as Sync from './sync/index';

function App() {
  const [listings, setListings] = useState('');

  Sync.initializeEvents.on('complete', (...args) => {
    setListings(JSON.stringify(args));
  });

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit {listings} <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
