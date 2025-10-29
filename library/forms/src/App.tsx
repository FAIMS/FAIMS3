import './App.css'
import {FormManager} from '../lib'

function App() {

  return (
    <>
      <h1>FAIMS3 Forms</h1>
      <div className="card">
        <FormManager someProp="someValue" />
      </div>
    </>
  )
}

export default App
