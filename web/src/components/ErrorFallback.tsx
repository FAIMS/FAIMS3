import {AlertCircle} from 'lucide-react';
import React from 'react';

// Fallback component shown when a render error occurs
export const ErrorFallback: React.FC<{bugsnagEnabled?: boolean}> = ({
  bugsnagEnabled,
}) => (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: '#f9fafb',
    }}
  >
    <div
      style={{
        maxWidth: '28rem',
        width: '100%',
        textAlign: 'center',
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '2.5rem',
        boxShadow:
          '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
      }}
    >
      <div
        style={{
          width: '4rem',
          height: '4rem',
          backgroundColor: '#fef2f2',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
        }}
      >
        <AlertCircle size={32} color="#dc2626" />
      </div>
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          color: '#111827',
          marginBottom: '0.5rem',
        }}
      >
        Something went wrong
      </h1>
      <p
        style={{
          color: '#6b7280',
          marginBottom: '1.5rem',
          lineHeight: 1.5,
        }}
      >
        An unexpected error occurred.
        {bugsnagEnabled &&
          ' This error has been automatically reported to our team.'}
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          backgroundColor: '#2563eb',
          color: 'white',
          fontWeight: 500,
          padding: '0.625rem 1.25rem',
          borderRadius: '0.375rem',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.875rem',
          transition: 'background-color 0.15s',
        }}
        onMouseOver={e => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
        onMouseOut={e => (e.currentTarget.style.backgroundColor = '#2563eb')}
      >
        Reload page
      </button>
    </div>
  </div>
);
