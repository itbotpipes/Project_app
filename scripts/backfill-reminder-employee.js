/**
 * Backfill script: add `employeeId` and `taskTitle` to Reminder documents
 * that were created before the schema update.
 *
 * Usage:
 *   node scripts/backfill-reminder-employee.js
 *   node scripts/backfill-reminder-employee.js --dry-run
 *
 * Prerequisites: set FIREBASE_SERVICE_ACCOUNT_KEY env var or place
 * your service account JSON at ./service-account.json (do NOT commit it).
 *
 * The script is idempotent — running it multiple times is safe.
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const DRY_RUN = process.argv.includes("--dry-run");

// Load service account
let serviceAccount;
const keyEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (keyEnv) {
  serviceAccount = JSON.parse(keyEnv);
} else {
  const keyPath = path.resolve(__dirname, "../service-account.json");
  serviceAccount = require(keyPath);
}

initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();

async function main() {
  console.log(`[backfill-reminder-employee] Starting${DRY_RUN ? " (DRY RUN)" : ""}…`);

  // Fetch all reminders that are missing employeeId
  const remindersSnap = await db.collection("Reminder").get();
  const missing = remindersSnap.docs.filter(d => !d.data().employeeId);

  console.log(`[backfill-reminder-employee] Total reminders: ${remindersSnap.size}, missing employeeId: ${missing.length}`);
  if (missing.length === 0) {
    console.log("[backfill-reminder-employee] Nothing to do. ✓");
    process.exit(0);
  }

  // Group reminders by taskId so we fetch each task only once
  const taskToReminders = new Map();
  for (const doc of missing) {
    const taskId = doc.data().taskId;
    if (!taskToReminders.has(taskId)) taskToReminders.set(taskId, []);
    taskToReminders.get(taskId).push(doc);
  }

  console.log(`[backfill-reminder-employee] Unique tasks to look up: ${taskToReminders.size}`);

  // Fetch tasks in parallel (batches of 20 to avoid overwhelming Firestore)
  const taskIds = [...taskToReminders.keys()];
  const taskData = new Map();
  const BATCH_SIZE = 20;
  for (let i = 0; i < taskIds.length; i += BATCH_SIZE) {
    const chunk = taskIds.slice(i, i + BATCH_SIZE);
    const fetches = await Promise.all(chunk.map(id => db.collection("Task").doc(id).get()));
    for (const snap of fetches) {
      if (snap.exists) taskData.set(snap.id, snap.data());
    }
  }

  // Batch writes (Firestore batch limit: 500 ops)
  const WRITE_BATCH = 500;
  let batchOps = db.batch();
  let opCount = 0;
  let updated = 0;
  let skipped = 0;

  for (const [taskId, reminderDocs] of taskToReminders) {
    const task = taskData.get(taskId);
    if (!task) {
      console.warn(`  [skip] Task ${taskId} not found — skipping ${reminderDocs.length} reminder(s)`);
      skipped += reminderDocs.length;
      continue;
    }

    for (const reminderDoc of reminderDocs) {
      const update = {
        employeeId: task.assigneeId,
        taskTitle: task.title,
      };
      if (!DRY_RUN) {
        batchOps.update(reminderDoc.ref, update);
        opCount++;
        if (opCount === WRITE_BATCH) {
          await batchOps.commit();
          console.log(`  [write] Committed ${WRITE_BATCH} ops`);
          batchOps = db.batch();
          opCount = 0;
        }
      } else {
        console.log(`  [dry-run] Would update Reminder ${reminderDoc.id}: employeeId=${task.assigneeId}, taskTitle="${task.title}"`);
      }
      updated++;
    }
  }

  if (!DRY_RUN && opCount > 0) {
    await batchOps.commit();
    console.log(`  [write] Committed final ${opCount} ops`);
  }

  console.log(`[backfill-reminder-employee] Done. Updated: ${updated}, Skipped: ${skipped}${DRY_RUN ? " (DRY RUN — no writes made)" : ""}`);
  process.exit(0);
}

main().catch(err => {
  console.error("[backfill-reminder-employee] Fatal error:", err);
  process.exit(1);
});
