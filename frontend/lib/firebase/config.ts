import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDwNvRiRwO7WY-qbRJ0MxLmNOL6YEub5uE",
  authDomain: "crm-project-ab1e4.firebaseapp.com",
  projectId: "crm-project-ab1e4",
  storageBucket: "crm-project-ab1e4.firebasestorage.app",
  messagingSenderId: "679661787741",
  appId: "1:679661787741:web:e2fc9d8b6dc180d3fe0bb4",
};

// Singleton pattern — Next.js hot-reload can call this multiple times
let app: FirebaseApp | undefined;
let auth: Auth | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}
