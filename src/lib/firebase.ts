import { initializeApp } from 'firebase/app';
import {
  getAuth,
  browserLocalPersistence,
  connectAuthEmulator,
  setPersistence,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

/** Opt-in, and only ever opt-in: an unset flag behaves exactly like production.
 *  The E2E suite sets this in .env.e2e, which carries no real credentials. */
const useEmulators = import.meta.env.VITE_FIREBASE_EMULATORS === 'true';
const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST ?? '127.0.0.1';
const authEmulatorPort = Number(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT ?? 9099);
const firestoreEmulatorPort = Number(
  import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT ?? 8080,
);

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = getFirestore(app);

if (useEmulators) {
  connectAuthEmulator(auth, `http://${emulatorHost}:${authEmulatorPort}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, emulatorHost, firestoreEmulatorPort);
}

void setPersistence(auth, browserLocalPersistence);
