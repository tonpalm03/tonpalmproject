import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (singleton pattern)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, { ignoreUndefinedProperties: true });
} catch {
  db = getFirestore(app);
}
const auth = getAuth(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'asia-southeast1');

// Local QA only: on localhost, setting localStorage cprufood_emulator=1 points the app at the
// Firestore and Auth emulators (firebase.emulators.json) so logged-in screens can be tested.
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  try {
    if (localStorage.getItem('cprufood_emulator') === '1') {
      connectFirestoreEmulator(db, '127.0.0.1', 8085);
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      (window as unknown as { __qaSignIn: (email: string, password: string) => Promise<unknown> }).__qaSignIn =
        (email, password) => signInWithEmailAndPassword(auth, email, password);
    }
  } catch {}
}

export { app, db, auth, storage, functions };
