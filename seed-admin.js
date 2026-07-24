require("dotenv").config({ path: ".env.local" });
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const bcrypt = require("bcryptjs");

async function seed() {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    })
  });
  
  const db = getFirestore();
  const email = "admin@company.com";
  const password = "password123";
  const passwordHash = await bcrypt.hash(password, 10);
  
  const empRef = db.collection("Employee").doc("admin-user-123");
  await empRef.set({
    name: "Admin User",
    email: email,
    passwordHash: passwordHash,
    active: true,
    systemRole: "ADMIN",
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  console.log(`Successfully created admin user: ${email} with password: ${password}`);
}

seed().catch(console.error);
