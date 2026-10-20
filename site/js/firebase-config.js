// Firebase-projektets publika inställningar (Projektinställningar → Your apps → Web).
// Uppgifterna är publika; datan skyddas av reglerna i firebase/firestore.rules.
export default {
  apiKey: "AIzaSyAVmr2lHnq25McH0IZvhGVsg14pUy8yFPY",
  authDomain: "groundly-d81f0.firebaseapp.com",
  projectId: "groundly-d81f0",
  storageBucket: "groundly-d81f0.firebasestorage.app",
  messagingSenderId: "8335055376",
  appId: "1:8335055376:web:45c50b6219ed086bf4c895",

  // Spark-planen: ingen Firebase Storage, så bilduppladdning är avstängd.
  // Sätt till true efter byte till Blaze och när Storage är aktiverat.
  photos: false,

  // Valfritt: adress till en egen AI-funktion. Tomt = AI-funktionerna döljs.
  aiEndpoint: ""
};
