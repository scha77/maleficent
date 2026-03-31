import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCrtwTSN9jVnW8toFJEE1IjaY3prGnyo6I",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "maleficent-8a7e5.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "maleficent-8a7e5",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "maleficent-8a7e5.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "223900655222",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:223900655222:web:e279d3b9d4863648adc957",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-FHK78LQ1MD",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
