import './App.css';
import {FormManager} from '../lib';

function App(props: {project: any}) {
  return (
    <>
      <h1>FAIMS3 Forms</h1>
      <div className="card">
        <FormManager project={props.project} formName="Person" />
      </div>
    </>
  );
}

export default App;
