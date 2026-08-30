import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Global fetch interceptor to redirect API calls to the remote backend in production/deployment
const originalFetch = window.fetch;
window.fetch = (url, options) => {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  if (baseUrl) {
    if (typeof url === 'string') {
      if (url.startsWith('/api/')) {
        url = `${baseUrl}${url}`;
      } else if (url.startsWith('http://localhost:8000/api/')) {
        url = url.replace('http://localhost:8000', baseUrl);
      }
    }
  }
  return originalFetch(url, options);
};


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
