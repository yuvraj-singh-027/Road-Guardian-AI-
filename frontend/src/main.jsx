import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Global fetch interceptor to redirect API calls properly across dev and production
const originalFetch = window.fetch;
window.fetch = (url, options) => {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const customApiUrl = import.meta.env.VITE_API_URL || '';

  if (typeof url === 'string') {
    if (url.startsWith('http://localhost:8000')) {
      if (customApiUrl) {
        url = url.replace('http://localhost:8000', customApiUrl);
      } else if (!isLocalhost) {
        url = url.replace('http://localhost:8000', '');
      }
    } else if (customApiUrl && url.startsWith('/api/')) {
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
