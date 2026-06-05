import "./styles/global-polish.css";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './context/ThemeContext';
import AgeGate from './components/AgeGate';
import CookieBanner from './components/CookieBanner';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AgeGate>
        <App />
        <CookieBanner />
      </AgeGate>
    </ThemeProvider>
  </StrictMode>
);
