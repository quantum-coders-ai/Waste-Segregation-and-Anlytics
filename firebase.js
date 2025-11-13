const firebaseConfig = {
    apiKey: "AIzaSyA7112Zj7hNpUdfNjPBoHv24X6zvJ-Jwsg",
    authDomain: "college-projects-83a0a.firebaseapp.com",
    projectId: "college-projects-83a0a",
    storageBucket: "college-projects-83a0a.firebasestorage.app",
    messagingSenderId: "110954216590",
    appId: "1:110954216590:web:07dca72de209be4adc9ddf",
    measurementId: "G-F4NHVWSY6M"
};

let db;
let auth;

export async function initFirebase(state) {
    try {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        console.log("Firebase initialized. Signing in...");
        
        await auth.signInAnonymously();
        const user = auth.currentUser;
        
        if (user) {
            console.log("Firebase Auth: Signed in anonymously. User ID:", user.uid);
            setupDataListener(state);
            return true;
        } else {
            throw new Error("Anonymous sign-in failed.");
        }
    } catch (error) {
        console.warn("Firebase connection failed. Running in Offline Mode.", error.message);
        return false;
    }
}

export async function saveWasteData(item) {
    if (!db || !auth.currentUser) return;
    try {
        const user = auth.currentUser;
        await db.collection("users").doc(user.uid).collection("waste_items").add(item);
    } catch (error) {
        console.error("Error saving data to Firestore:", error);
    }
}

function setupDataListener(appState) {
    if (!db || !auth.currentUser) return;
    const user = auth.currentUser;

    db.collection("users").doc(user.uid).collection("waste_items")
      .orderBy("timestamp", "desc")
      .limit(1000)
      .onSnapshot((snapshot) => {
          console.log("Firebase: Data snapshot received.");

          let dataChanged = false;
          
          snapshot.docChanges().forEach(change => {
              dataChanged = true;
              const docData = { id: change.doc.id, ...change.doc.data() };
              const index = appState.allData.findIndex(item => item.id === change.doc.id);

              if (change.type === "added") {
                  if (index === -1) {
                       appState.allData.push(docData);
                  }
              }
              if (change.type === "modified") {
                  if (index > -1) {
                      appState.allData[index] = docData;
                  }
              }
              if (change.type === "removed") {
                  if (index > -1) {
                      appState.allData.splice(index, 1);
                  }
              }
          });

          if (dataChanged) {
              appState.allData.sort((a, b) => a.timestamp - b.timestamp);
              
              if (appState.allData.length > 1000) {
                  appState.allData = appState.allData.slice(appState.allData.length - 1000);
              }

              appState.triggerAnalyticsUpdate();
          }
      }, (error) => {
          console.error("Error with Firestore listener:", error);
      });
}
