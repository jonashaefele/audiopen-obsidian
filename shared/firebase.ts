/// <reference types="vite/client" />

import { FirebaseOptions, initializeApp } from 'firebase/app'

const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyBN58Umn62jNrSPTSU_f7wMqBX5M1aGfZ4',
  authDomain: 'audiopen-obsidian.firebaseapp.com',
  databaseURL:
    'wss://audiopen-obsidian-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'audiopen-obsidian',
  storageBucket: 'audiopen-obsidian.appspot.com',
  messagingSenderId: '548543351364',
  appId: '1:548543351364:web:d3ed2b4e2384d242c68a11',
  measurementId: 'G-93WY19MK85',
}

const app = initializeApp(firebaseConfig)

export default app
