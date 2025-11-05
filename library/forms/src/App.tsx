import './App.css';
import {FormConfig, FormManager} from '../lib';

function App(props: {project: any}) {
  const formConfig: FormConfig = {
    context: {mode: 'preview'},
  };
  return (
    <>
      <h1>FAIMS3 Forms</h1>
      <div className="card">
        <div
          style={{
            padding: '16px',
            border: '1px solid #ccc',
            borderRadius: '8px',
          }}
        >
          <FormManager
            project={props.project}
            formName="Person"
            config={formConfig}
          />
        </div>
      </div>
    </>
  );
}

export default App;
