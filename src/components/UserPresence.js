import { db, auth } from '../firebase';

const setupPresence = () => {
  const userStatusRef = db.doc(`status/${auth.currentUser.uid}`);
  
  // Status quando online
  const onlineStatus = {
    state: 'online',
    lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    email: auth.currentUser.email
  };

  // Status quando offline
  const offlineStatus = {
    state: 'offline',
    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
  };

  // Configura listeners de conexão
  db.collection('status')
    .doc(auth.currentUser.uid)
    .onDisconnect()
    .set(offlineStatus)
    .then(() => {
      userStatusRef.set(onlineStatus);
    });
}