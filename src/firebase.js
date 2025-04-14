// src/firebase.js
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';   // <- importe o Firestore

const firebaseConfig = {
  apiKey: "AIzaSyAf5x3XpFcd6zrQ83O0NSPucPmEtY3oQjI",
  authDomain: "bipagem1.firebaseapp.com",
  projectId: "bipagem1",
  storageBucket: "bipagem1.firebasestorage.app",
  messagingSenderId: "356766012391",
  appId: "1:356766012391:web:7dae992eaf47badf7ee342",
  measurementId: "G-5K119X02TD"
};

// Inicializa Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Inicializa Firestore e Auth
const db = firebase.firestore();
const auth = firebase.auth();

// Adicione esta função
const createRequiredIndexes = async () => {
  try {
    // Verifica se o índice já existe
    const indexes = await firebase.firestore().collection('dtf_records')
      .listIndexes();
    
    const hasRequiredIndex = indexes.some(index => 
      index.fields.length === 2 &&
      index.fields[0].fieldPath === 'verificationType' &&
      index.fields[1].fieldPath === 'timestamp'
    );

    if (!hasRequiredIndex) {
      // Cria o índice
      await firebase.firestore().collection('dtf_records')
        .createIndex({
          fields: [
            { fieldPath: 'verificationType', order: 'ASCENDING' },
            { fieldPath: 'timestamp', order: 'ASCENDING' }
          ]
        });
      
      console.log('Índice criado com sucesso!');
    }
  } catch (error) {
    console.error('Erro ao criar índice:', error);
  }
};

// Chame a função durante a inicialização
createRequiredIndexes();

// Exporta os objetos necessários
export { db, auth, firebase };