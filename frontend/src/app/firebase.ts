// src/app/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCb1Zmbm5Xmn2ACXcVd5BhsuFfGUsnu4Wk",
  authDomain: "nlpconnector.firebaseapp.com",
  projectId: "nlpconnector",
  storageBucket: "nlpconnector.firebasestorage.app",
  messagingSenderId: "581277715925",
  appId: "1:581277715925:web:65ade66dbe3efba6b4c15c",
  measurementId: "G-4YSJXM1KPN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

export { auth };
