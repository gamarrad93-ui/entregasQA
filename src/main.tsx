import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import { DisplayProvider } from './ui/display';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DisplayProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </DisplayProvider>
  </React.StrictMode>,
);
