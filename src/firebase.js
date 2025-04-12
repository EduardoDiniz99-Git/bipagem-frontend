// src/firebase.js
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";   // <- importe o Firestore

const firebaseConfig = {
  apiKey: "AIzaSyAf5x3XpFcd6zrQ83O0NSPucPmEtY3oQjI",
  authDomain: "bipagem1.firebaseapp.com",
  projectId: "bipagem1",
  storageBucket: "bipagem1.firebasestorage.app",
  messagingSenderId: "356766012391",
  appId: "1:356766012391:web:7dae992eaf47badf7ee342",
  measurementId: "G-5K119X02TD"
};

firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth();
export const db   = firebase.firestore();   // <- exporte a instância do Firestore
export default firebase;

db.settings({ experimentalForceLongPolling: true });