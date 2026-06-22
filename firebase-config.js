// Firebase-Konfiguration – einmalig ausfüllen
// Anleitung:
//   1. https://console.firebase.google.com → Neues Projekt erstellen (z.B. "fortuna-scout")
//   2. Links: "Realtime Database" → Datenbank erstellen → Region: europe-west1 → Testmodus
//   3. Projekteinstellungen (Zahnrad) → "Deine Apps" → Web-App (</>)  → App registrieren
//   4. Den "firebaseConfig"-Block unten einfügen (const FIREBASE_CONFIG = { ... })

const FIREBASE_CONFIG = null; // <-- Zeile ersetzen sobald du die Daten hast

/* Beispiel – NICHT als Variable null lassen:
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",
  authDomain:        "fortuna-scout-xxxx.firebaseapp.com",
  databaseURL:       "https://fortuna-scout-xxxx-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "fortuna-scout-xxxx",
  storageBucket:     "fortuna-scout-xxxx.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef"
};
*/
