/**
 * Firebase client configuration for the ClubStack project.
 *
 * These values are public browser identifiers, not secrets: the API key only
 * names the Firebase project. All data access is enforced by `firestore.rules`,
 * and no service-account or Admin SDK credential belongs in this app.
 *
 * Values in `.env.local` (VITE_FIREBASE_*) take precedence, so a build can be
 * pointed at a different Firebase project without editing this file.
 */
const projectDefaults = {
  apiKey: 'AIzaSyB39IFNpTCdFTtg7HU07Y1zg8Ccw9TteU4',
  authDomain: 'clubstackapp2.firebaseapp.com',
  projectId: 'clubstackapp2',
  storageBucket: 'clubstackapp2.firebasestorage.app',
  messagingSenderId: '598109793981',
  appId: '1:598109793981:web:b05c88a0021a1c6e5691d4',
  measurementId: 'G-XY2L5DFQ9J',
}

function envValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

export const firebaseConfig = {
  apiKey: envValue(import.meta.env.VITE_FIREBASE_API_KEY) ?? projectDefaults.apiKey,
  authDomain: envValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) ?? projectDefaults.authDomain,
  projectId: envValue(import.meta.env.VITE_FIREBASE_PROJECT_ID) ?? projectDefaults.projectId,
  storageBucket:
    envValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) ?? projectDefaults.storageBucket,
  messagingSenderId:
    envValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) ??
    projectDefaults.messagingSenderId,
  appId: envValue(import.meta.env.VITE_FIREBASE_APP_ID) ?? projectDefaults.appId,
  measurementId:
    envValue(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) ?? projectDefaults.measurementId,
}
