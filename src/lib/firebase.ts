import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { firebaseConfig } from './firebaseConfig'

const requiredKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
] as const

export const isFirebaseConfigured = requiredKeys.every((key) => {
  const value = firebaseConfig[key]
  return typeof value === 'string' && value.length > 0
})

export const isDemoMode =
  import.meta.env.VITE_DEMO_MODE === 'true' || !isFirebaseConfigured

let app: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null

if (!isDemoMode) {
  app = initializeApp(firebaseConfig)
  authInstance = getAuth(app)
  dbInstance = getFirestore(app)
}

export const firebaseAuth = authInstance
export const firestore = dbInstance
