import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY     || 'AIzaSyDlbAAJg9B2LG2mu-C4_GzsWZRXK8XICk4',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'betly-1a8e6.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID  || 'betly-1a8e6',
  storageBucket:     'betly-1a8e6.firebasestorage.app',
  messagingSenderId: '232008587463',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID      || '1:232008587463:web:2d6508134d978df721c6e2',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Force local persistence so auth survives page reload
setPersistence(auth, browserLocalPersistence).catch(() => {});
export const googleProvider = new GoogleAuthProvider();
