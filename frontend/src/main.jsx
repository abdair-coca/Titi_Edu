import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { GamificationProvider } from './context/GamificationContext.jsx';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <GamificationProvider>
          <App />
        </GamificationProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
