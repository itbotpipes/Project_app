require("dotenv").config({ path: ".env.local" });
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const ALL_PAGES = [
  "dashboard",
  "board",
  "groups",
  "delegated",
  "subscribed",
  "templates",
  "deleted",
  "team",
  "performance",
  "insights",
  "org",
  "scores",
  "announcements",
  "people",
  "leaderboard",
  "activities",
  "admin"
];

const MANAGER_PAGES = [
  "dashboard",
  "board",
  "groups",
  "delegated",
  "subscribed",
  "templates",
  "deleted",
  "team",
  "performance",
  "insights",
  "org",
  "scores",
  "announcements",
  "people",
  "leaderboard",
  "activities"
];

const EMPLOYEE_PAGES = [
  "dashboard",
  "board",
  "groups",
  "subscribed",
  "templates",
  "deleted",
  "performance",
  "insights",
  "org",
  "leaderboard",
  "activities"
];

async function seed() {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    })
  });
  
  const db = getFirestore();
  const rolesSnap = await db.collection("Role").get();
  
  console.log(`Found ${rolesSnap.size} roles to process...`);
  
  const batch = db.batch();
  
  rolesSnap.forEach((doc) => {
    const data = doc.data();
    const title = (data.title || "").toLowerCase();
    const level = data.level || 5;
    
    let permissions = EMPLOYEE_PAGES;
    
    if (level <= 1 || title.includes("ceo") || title.includes("director") || title.includes("admin")) {
      permissions = ALL_PAGES;
      console.log(`Setting full permissions for role: "${data.title}"`);
    } else if (title.includes("manager") || title.includes("head") || title.includes("lead") || title.includes("hr")) {
      permissions = MANAGER_PAGES;
      console.log(`Setting manager permissions for role: "${data.title}"`);
    } else {
      console.log(`Setting employee permissions for role: "${data.title}"`);
    }
    
    batch.update(doc.ref, { permissions });
  });
  
  await batch.commit();
  console.log("Roles successfully seeded with permissions!");
}

seed().catch(console.error);
