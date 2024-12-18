import {useAuthStore} from './context/store';
import {useState} from 'react';

const buttonStyle = {
  display: 'block',
  padding: '8px 16px',
  marginBottom: '8px',
  backgroundColor: '#0066cc',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
};

const inputStyle = {
  padding: '8px',
  marginBottom: '8px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  width: '200px',
};

const selectStyle = {
  padding: '8px',
  marginBottom: '8px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  width: '100%',
  backgroundColor: 'white',
};

const containerStyle = {
  padding: '16px',
};

const preStyle = {
  backgroundColor: '#f5f5f5',
  padding: '8px',
  borderRadius: '4px',
  marginBottom: '16px',
  overflow: 'auto',
};

const errorStyle = {
  backgroundColor: '#ffebee',
  color: '#c62828',
  padding: '8px',
  borderRadius: '4px',
  marginTop: '16px',
};

const sectionStyle = {
  marginBottom: '20px',
  padding: '16px',
  border: '1px solid #eee',
  borderRadius: '4px',
};

export const TestComponent = () => {
  const [newServerId, setNewServerId] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [selectedServer, setSelectedServer] = useState('');
  const [selectedUser, setSelectedUser] = useState('');

  const {
    servers,
    activeUser,
    refreshError,
    isAuthenticated,
    setServerConnection,
    setActiveUser: setActiveConnection,
    removeServerConnection,
    clearActiveConnection,
    refreshToken,
  } = useAuthStore();

  const addConnection = async () => {
    if (!newServerId || !newUsername) return;

    setServerConnection({
      serverId: newServerId,
      username: newUsername,
      parsedToken: {
        username: newUsername,
        roles: ['user'],
        server: newServerId,
      },
      token: 'fake-token',
      refreshToken: 'fake-token',
    });
    setNewServerId('');
    setNewUsername('');
  };

  const refreshActive = async () => {
    if (activeUser) {
      await refreshToken({
        serverId: activeUser.serverId,
        username: activeUser.username,
      });
    }
  };

  // Get array of server IDs
  const serverIds = Object.keys(servers);

  // Get array of usernames for selected server
  const usernames = selectedServer
    ? Object.keys(servers[selectedServer]?.users || {})
    : [];

  return (
    <div style={containerStyle}>
      <h2 style={{marginBottom: '16px'}}>Auth Store Test Component</h2>

      {/* Add new connection section */}
      <div style={sectionStyle}>
        <h3 style={{marginBottom: '8px'}}>Add New Connection</h3>
        <input
          type="text"
          placeholder="Server ID"
          value={newServerId}
          onChange={e => setNewServerId(e.target.value)}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="Username"
          value={newUsername}
          onChange={e => setNewUsername(e.target.value)}
          style={inputStyle}
        />
        <button
          onClick={addConnection}
          style={buttonStyle}
          disabled={!newServerId || !newUsername}
        >
          Add Connection
        </button>
      </div>

      {/* Manage existing connections section */}
      <div style={sectionStyle}>
        <h3 style={{marginBottom: '8px'}}>Manage Connections</h3>
        <select
          value={selectedServer}
          onChange={e => {
            setSelectedServer(e.target.value);
            setSelectedUser('');
          }}
          style={selectStyle}
        >
          <option value="">Select Server</option>
          {serverIds.map(id => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>

        {selectedServer && (
          <select
            value={selectedUser}
            onChange={e => setSelectedUser(e.target.value)}
            style={selectStyle}
          >
            <option value="">Select User</option>
            {usernames.map(username => (
              <option key={username} value={username}>
                {username}
              </option>
            ))}
          </select>
        )}

        {selectedServer && selectedUser && (
          <div>
            <button
              onClick={() =>
                setActiveConnection({
                  serverId: selectedServer,
                  username: selectedUser,
                })
              }
              style={buttonStyle}
            >
              Set As Active
            </button>
            <button
              onClick={() =>
                removeServerConnection({
                  serverId: selectedServer,
                  username: selectedUser,
                })
              }
              style={{...buttonStyle, backgroundColor: '#dc3545'}}
            >
              Remove Connection
            </button>
          </div>
        )}
      </div>

      {/* Active connection section */}
      <div style={sectionStyle}>
        <h3 style={{marginBottom: '8px'}}>Active Connection</h3>
        {activeUser ? (
          <>
            <p>Server: {activeUser.serverId}</p>
            <p>User: {activeUser.username}</p>
            <button
              onClick={refreshActive}
              style={{...buttonStyle, backgroundColor: '#6f42c1'}}
            >
              Refresh Token
            </button>
            <button
              onClick={clearActiveConnection}
              style={{
                ...buttonStyle,
                backgroundColor: '#ffc107',
                color: 'black',
              }}
            >
              Clear Active Connection
            </button>
          </>
        ) : (
          <p>No active connection</p>
        )}
      </div>

      {/* State display */}
      <div style={sectionStyle}>
        <h3 style={{marginBottom: '8px'}}>Current State</h3>
        <pre style={preStyle}>
          {JSON.stringify(
            {
              servers,
              activeConnection: activeUser,
              refreshError,
              isAuthenticated,
            },
            null,
            2
          )}
        </pre>
      </div>

      {refreshError && <div style={errorStyle}>Error: {refreshError}</div>}
    </div>
  );
};

export default TestComponent;
