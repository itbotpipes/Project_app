const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");

const env = fs.readFileSync(".env.local", "utf8");
const pid = env.match(/FIREBASE_PROJECT_ID="(.*?)"/)[1];
const email = env.match(/FIREBASE_CLIENT_EMAIL="(.*?)"/)[1];
const pk = env.match(/FIREBASE_PRIVATE_KEY="(.*?)"/)[1].replace(/\\n/g, "\n");

initializeApp({
  credential: cert({ projectId: pid, clientEmail: email, privateKey: pk })
});

const db = getFirestore();
const links = new Set();

async function runQuery(promise) {
  try {
    await promise;
  } catch (err) {
    if (err.message && err.message.includes("https://console.firebase.google.com")) {
      const link = err.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)[0];
      links.add(link);
    }
  }
}

async function main() {
  console.log("Checking for ANY remaining queries...");
  const t = db.collection("Task");
  const now = new Date();
  
  await Promise.all([
    // all queries with orderBy or inequality
    runQuery(t.where("deletedAt", "!=", null).orderBy("deletedAt", "desc").get()),
    runQuery(t.where("status", "!=", "CLOSED").where("updatedAt", "<", now).orderBy("updatedAt", "asc").get()),
    runQuery(db.collection("TaskTemplate").where("roleId", "!=", null).orderBy("roleId", "asc").orderBy("createdAt", "desc").get()),
    runQuery(db.collection("Announcement").orderBy("pinned", "desc").orderBy("createdAt", "desc").get()),
    runQuery(db.collection("AuditLog").where("entity", "==", "Task").where("entityId", "==", "x").orderBy("createdAt", "desc").get()),
    runQuery(db.collection("AuditLog").where("actorId", "==", "x").orderBy("createdAt", "desc").get()),
    runQuery(db.collection("TaskWatcher").where("employeeId", "==", "x").orderBy("createdAt", "desc").get()),
    runQuery(db.collection("BirthdayWish").where("forId", "==", "x").where("year", "==", 2025).orderBy("createdAt", "desc").get()),
    runQuery(db.collection("Comment").where("announcementId", "==", "x").orderBy("createdAt", "asc").get()),
    runQuery(db.collection("ChecklistItem").where("taskId", "==", "x").orderBy("orderIndex", "asc").get()),
    runQuery(db.collection("Attachment").where("taskId", "==", "x").orderBy("createdAt", "desc").get()),
    runQuery(db.collection("TaskComment").where("taskId", "==", "x").orderBy("createdAt", "asc").get()),
  ]);

  console.log("\n✅ ADDITIONAL MISSING INDEX LINKS:\n");
  let i = 1;
  for (const link of links) {
    console.log(`Link ${i++}:\n${link}\n`);
  }
}

main();
