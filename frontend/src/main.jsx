import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Global fetch interceptor to handle cross-origin API calls when VITE_API_URL is configured
const originalFetch = window.fetch;
window.fetch = (url, options) => {
  const customApiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  if (typeof url === 'string') {
    if (customApiUrl && url.startsWith('/api/')) {
      url = `${customApiUrl}${url}`;
    }
  }
  return originalFetch(url, options);
};


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
