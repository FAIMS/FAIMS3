import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as Sync from './sync/index';

// TODO: show react (loading bar?) and Sync the DBs
// at the same time (Making sure DB calls can handle this)
async function initialize() {

  await Sync.populate_test_data();

  await Sync.initialize_dbs({
      proto: 'http',
      host: '10.80.11.44',
      port: 5984,
      db_name: 'directory'
  });

}
initialize().then(() => {

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);


}).catch(e => {
  // TODO: Prettier error

  ReactDOM.render(
    <p>Error: {e.toString()}</p>,
    document.getElementById('root')
  );
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
