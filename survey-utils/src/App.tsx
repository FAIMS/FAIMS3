import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { SchemaDescriberPage } from './pages/SchemaDescriberPage';
import { SurveyDiffPage } from './pages/SurveyDiffPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/schema-describer" element={<SchemaDescriberPage />} />
        <Route path="/survey-diff" element={<SurveyDiffPage />} />
      </Routes>
    </BrowserRouter>
  );
}
