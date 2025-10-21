import {useState} from 'react';
import {RenderFunctionComponent} from '../../types';

export const FieldDebugger: RenderFunctionComponent = props => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      style={{
        border: '2px solid #ff6b6b',
        borderRadius: '4px',
        margin: '8px 0',
        backgroundColor: '#fff5f5',
      }}
    >
      {/* Toggle Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: '#ff6b6b',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>🐛 Field Debugger: {props.rendererContext.fieldId}</span>
        <span>{isOpen ? '▼' : '►'}</span>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div
          style={{padding: '16px', fontFamily: 'monospace', fontSize: '12px'}}
        >
          {/* Render Context */}
          <section style={{marginBottom: '16px'}}>
            <h4 style={{margin: '0 0 8px 0', color: '#333'}}>Render Context</h4>
            <ul style={{margin: 0, paddingLeft: '20px'}}>
              <li>
                <strong>Field ID:</strong> {props.rendererContext.fieldId}
              </li>
              <li>
                <strong>View ID:</strong> {props.rendererContext.viewId}
              </li>
              <li>
                <strong>Viewset ID:</strong> {props.rendererContext.viewsetId}
              </li>
            </ul>
          </section>

          {/* Value */}
          <section style={{marginBottom: '16px'}}>
            <h4 style={{margin: '0 0 8px 0', color: '#333'}}>Value</h4>
            <pre
              style={{
                backgroundColor: '#f5f5f5',
                padding: '8px',
                borderRadius: '4px',
                overflow: 'auto',
                margin: 0,
                border: '1px solid #ddd',
              }}
            >
              {JSON.stringify(props.value, null, 2)}
            </pre>
          </section>

          {/* Configuration */}
          <section style={{marginBottom: '16px'}}>
            <h4 style={{margin: '0 0 8px 0', color: '#333'}}>Configuration</h4>
            <pre
              style={{
                backgroundColor: '#f5f5f5',
                padding: '8px',
                borderRadius: '4px',
                overflow: 'auto',
                margin: 0,
                border: '1px solid #ddd',
              }}
            >
              {JSON.stringify(props.config, null, 2)}
            </pre>
          </section>

          {/* Record Metadata */}
          <section>
            <h4 style={{margin: '0 0 8px 0', color: '#333'}}>
              Record Metadata
            </h4>
            <pre
              style={{
                backgroundColor: '#f5f5f5',
                padding: '8px',
                borderRadius: '4px',
                overflow: 'auto',
                margin: 0,
                border: '1px solid #ddd',
              }}
            >
              {JSON.stringify(props.rendererContext.recordMetadata, null, 2)}
            </pre>
          </section>
        </div>
      )}
    </div>
  );
};
