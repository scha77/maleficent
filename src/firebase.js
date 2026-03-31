// ─────────────────────────────────────────────────────────
//  🔥  FIREBASE SETUP — Replace these with YOUR values
// ─────────────────────────────────────────────────────────
//
//  1. Go to https://console.firebase.google.com
//  2. Click "Add project" → name it anything → create
//  3. Click the web icon (</>) to add a web app → register
//  4. Copy the firebaseConfig object and paste below
//  5. In the left sidebar → Build → Firestore Database → Create database → Start in TEST mode
//  6. In the left sidebar → Build → Storage → Get started → Start in TEST mode
//  7. Done! Run `npm run dev` to test locally
//
// ─────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCrtwTSN9jVnW8toFJEE1IjaY3prGnyo6I",
  authDomain: "maleficent-8a7e5.firebaseapp.com",
  projectId: "maleficent-8a7e5",
  storageBucket: "maleficent-8a7e5.firebasestorage.app",
  messagingSenderId: "223900655222",
  appId: "1:223900655222:web:e279d3b9d4863648adc957",
  measurementId: "G-FHK78LQ1MD"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
