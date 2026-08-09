import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAtq6PUYRBGPouunH-evAZOK2JsoQqJRRg",
  authDomain: "botaye-a0577.firebaseapp.com",
  projectId: "botaye-a0577",
  storageBucket: "botaye-a0577.firebasestorage.app",
  messagingSenderId: "447110873653",
  appId: "1:447110873653:web:b1b2832d6dfddb9403a77c",
};

const app = initializeApp(firebaseConfig, "membre");
const auth = getAuth(app);
const db = getFirestore(app);

async function changerMotDePasse(email, ancienMotDePasse, nouveauMotDePasse) {
  const credential = EmailAuthProvider.credential(email, ancienMotDePasse);
  await reauthenticateWithCredential(auth.currentUser, credential);
  await updatePassword(auth.currentUser, nouveauMotDePasse);
}

export {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  changerMotDePasse,
};
