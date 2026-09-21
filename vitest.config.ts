import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Vitest's default glob would also pick up e2e/**/*.spec.ts, which are
    // Playwright tests and cannot run here.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // src/lib/firebase.ts runs initializeApp at import, and getAuth rejects a
    // missing apiKey outright. A developer machine has a .env.local and never
    // notices; CI has no keys, so any suite that reaches a real component
    // throws auth/invalid-api-key before its first test. These are obvious
    // non-credentials — Firestore itself is mocked in every suite that talks
    // to it, so nothing here is ever sent anywhere.
    env: {
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-test',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-test.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '0',
      VITE_FIREBASE_APP_ID: '1:0:web:0',
    },
    clearMocks: true,
    restoreMocks: true,
  },
});
