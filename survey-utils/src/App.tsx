import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { SchemaDescriberPage } from './pages/SchemaDescriberPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/schema-describer" element={<SchemaDescriberPage />} />
      </Routes>
    </BrowserRouter>
  );
}
