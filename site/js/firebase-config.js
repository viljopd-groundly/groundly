// Klistra in värdena från Firebase-konsolen: Projektinställningar → Your apps → Web → firebaseConfig.
// Uppgifterna här är publika (de skyddas av reglerna i firebase/firestore.rules), så filen kan ligga i repot.
export default {
  apiKey: "DIN_API_KEY",
  authDomain: "DITT-PROJEKT.firebaseapp.com",
  projectId: "DITT-PROJEKT",
  storageBucket: "DITT-PROJEKT.firebasestorage.app",
  messagingSenderId: "",
  appId: "",

  // Sätt till false om du inte har Blaze-planen – då stängs bilduppladdning av.
  photos: true,

  // Valfritt: adress till en egen AI-funktion (se README). Tomt = AI-funktionerna döljs.
  aiEndpoint: ""
};
