// src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const container = document.getElementById('root'); // Verifique se esse elemento existe no index.html
if (!container) {
  throw new Error("O elemento com id 'root' não foi encontrado.");
}
const root = createRoot(container);
root.render(<App />);
