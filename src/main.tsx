import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const root = createRoot(document.getElementById('root')!);

if (!import.meta.env.VITE_FIREBASE_API_KEY) {
  root.render(
    <div style={{ padding: '3rem', fontFamily: 'system-ui', maxWidth: 480, margin: '0 auto' }}>
      <h1>Missing Firebase config</h1>
      <p>
        Copy <code>.env.example</code> to <code>.env.local</code>, paste your Firebase web-app
        config values, and restart the dev server.
      </p>
    </div>,
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
