// Enable offline persistence
db.enablePersistence()
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time
      console.log('Persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support persistence
      console.log('Persistence not supported by this browser');
    }
  });

// Error handling
const handleFirebaseError = (error) => {
  console.error('Firebase error:', error);
  if (error.code === 'permission-denied') {
    console.warn('Firestore permission denied - check your security rules');
    // Switch to in-memory storage
    window.useInMemoryStorage = true;
  }
  return error;
};

// Set up auth state change listener
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    console.log('User signed in:', user.uid);
  } else {
    // Try to sign in anonymously for reading/writing to Firestore
    firebase.auth().signInAnonymously()
      .catch(handleFirebaseError);
  }
});