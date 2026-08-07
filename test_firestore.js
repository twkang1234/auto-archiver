const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc } = require("firebase/firestore");
const fs = require("fs");

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json"));
const app = initializeApp(config);
const db = getFirestore(app);

async function test() {
  try {
    const docRef = await addDoc(collection(db, "test_collection"), {
      test: "data"
    });
    console.log("Success! Doc ID:", docRef.id);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
