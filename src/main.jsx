import React from 'react';
import { createRoot } from 'react-dom/client';
// Global styles first, so component CSS (button variants, panels) loads after
// them and wins ties at equal specificity.
import './styles/index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
