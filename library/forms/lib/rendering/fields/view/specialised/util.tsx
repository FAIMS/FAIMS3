import {useState} from 'react';
import {DataViewFieldRender} from '../../../types';

export const FieldDebugger: DataViewFieldRender = props => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      style={{
        borderRadius: '4px',
        margin: '8px 0',
        backgroundColor: 'lightblue',
      }}
    >
      {/* Toggle Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: 'lightblue',
          color: 'black',
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
        <span>🐛 Field Debugger: {props.renderContext.fieldId}</span>
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
                <strong>Field ID:</strong> {props.renderContext.fieldId}
              </li>
              <li>
                <strong>View ID:</strong> {props.renderContext.viewId}
              </li>
              <li>
                <strong>Viewset ID:</strong> {props.renderContext.viewsetId}
              </li>
              <li>
                <strong>Component name</strong> {props.renderContext.fieldName}
              </li>
              <li>
                <strong>Component namespace</strong>{' '}
                {props.renderContext.fieldNamespace}
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
              {JSON.stringify(props.renderContext.record, null, 2)}
            </pre>
          </section>
        </div>
      )}
    </div>
  );
};
