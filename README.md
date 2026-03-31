# Reasons We're Concerned

A collaborative evidence board where anyone with the link can add screenshots, social media embeds, and context — organized by theme with an interactive timeline view and NSFW content gating.

---

## Quick Setup (10 minutes)

### 1. Create a Firebase project (free)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add project** → name it anything → click through the steps
3. Once created, click the **web icon** (`</>`) on the project overview page
4. Register the app (name doesn't matter) → copy the `firebaseConfig` object

### 2. Enable Firestore + Storage

1. In the Firebase sidebar → **Build → Firestore Database**
2. Click **Create database** → choose **Start in test mode** → pick a location → done
3. In the sidebar → **Build → Storage**
4. Click **Get started** → **Start in test mode** → done

### 3. Add your Firebase config

Open `src/firebase.js` and replace the placeholder values with your real config:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
};
```

### 4. Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` — you should see the app!

### 5. Deploy to Vercel

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your GitHub repo
4. Vercel auto-detects Vite — just click **Deploy**
5. Done! Share the URL with your trusted people

---

## Features

- **Embed links** from Instagram, TikTok, YouTube, and X/Twitter
- **Upload screenshots** directly (stored in Firebase Storage)
- **Categorize** evidence: Lies, Manipulation, Money, Character, Relationships, Other
- **NSFW gating** — sensitive items are blurred with a click-to-reveal warning
- **Timeline view** — all evidence on an interactive timeline sorted by source date
- **Search & filter** across all evidence
- **Real-time sync** — when someone adds evidence, everyone sees it instantly
- **Mobile-friendly** — works great on phones
- **Delete** individual items with the ✕ button

---

## Security Notes

- **Test mode** Firestore/Storage rules expire after 30 days. Before they expire, update your rules:
  - Firestore: allow read/write for your use case
  - Storage: allow read/write for uploads
- This app has **no authentication** — anyone with the link can add and delete
- If you need to restrict access, you can add Firebase Auth later

---

## Project Structure

```
evidence-site/
├── index.html          ← Entry HTML
├── package.json        ← Dependencies
├── vite.config.js      ← Vite config
└── src/
    ├── main.jsx        ← React mount
    ├── firebase.js     ← 🔥 YOUR CONFIG HERE
    └── App.jsx         ← Full app
```
