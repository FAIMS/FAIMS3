import './App.css';
import {PreviewFormManager} from '../lib';

function App(props: {project: any}) {
  const uiSpec = props.project['ui-specification'];
  uiSpec.views = uiSpec.fviews;

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
          <PreviewFormManager formName="Person" uiSpec={uiSpec} />
        </div>
      </div>
    </>
  );
}

export default App;
