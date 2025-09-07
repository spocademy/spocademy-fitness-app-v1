// src/services/firebase/config.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC_Fm-hxEyAZigpydCWH1n7Y8IUrNe9qxM",
  authDomain: "spocademy-mvp1.firebaseapp.com",
  projectId: "spocademy-mvp1",
  storageBucket: "spocademy-mvp1.firebasestorage.app",
  messagingSenderId: "910046288653",
  appId: "1:910046288653:web:2e836eb413309925d26e44"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;