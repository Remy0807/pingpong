import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
};

const parseWebConfig = (): FirebaseWebConfig | null => {
  const rawConfig = import.meta.env.VITE_FIREBASE_WEBAPP_CONFIG;
  if (rawConfig?.trim()) {
    try {
      return JSON.parse(rawConfig) as FirebaseWebConfig;
    } catch {
      throw new Error(
        "VITE_FIREBASE_WEBAPP_CONFIG must be valid JSON with Firebase web app config."
      );
    }
  }

  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  };
};

const firebaseConfig = parseWebConfig();

if (!firebaseConfig) {
  throw new Error(
    "Firebase web config missing. Set VITE_FIREBASE_WEBAPP_CONFIG or the individual VITE_FIREBASE_* values."
  );
}

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);

setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {
  // Best effort persistence; fallback is fine in unsupported environments.
});
