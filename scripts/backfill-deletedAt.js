/**
 * ONE-TIME BACKFILL: Add deletedAt: null to Task docs that are missing the field.
 * Uses credentials from .env.local directly.
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp({
  credential: cert({
    projectId: "project-app-e3788",
    clientEmail: "firebase-adminsdk-fbsvc@project-app-e3788.iam.gserviceaccount.com",
    privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDkRHzKrJJTqKpb\nh/LeGlPsZmiknrUGQu+cBPP0P2aYjHoamwhmXkz5xn32XORSeQOq/K1vnlNJjdnK\n+x58E14jE7ikBj9flyaslpss7rH//BXjGF4OiY7IUe/ll02VfGDWLfblZlU4F4Fp\nXrEUYicgshDBosKxehWrT7l7ilUszFDy0/917Ve39YypsOa1Mei3H1264YJGTMUO\nD2xaRNR5LaI5rCqHlorw7WfnBpPwYGRIMh901IM9sP7HDCd3R/YQ1wd8OJ0uj1g9\nTTbUv5vbOXtf608DGdFws+U1iiCAEOFX04TmcLzbf26PIbP0nt6XhQ7mc463Fujx\naLVREkBHAgMBAAECggEAZvMiizAAwL1ps+VhGl2qawyW9mPjxgKrWWT8d7See3+j\n1FsGk1DFi8NDbTjg+vc8OcJDIHu6GYrh5sOSMKh1hQFwfX2Z2G1t0loMe1veKNMT\nNfx38zuEC4G03gn6wkg5zm8lkrmwBp/HTHQaDlTkS8EzgHl9MJkcq8pFn9u4ZX6Y\nbzv+BIUz1tUklfwhr46yWoqg7efZAMRb6aYgkI5gqdZtV/Vx1jhTIdxzO2ikbfG+\nUknowFpvNCSWqAM968K++RvyB7F+KaL6tZiAVX9IeAAKsGV7XtNcax/TAkod2vB6\nKVP3wrSdrqpGI1OsqVY1b80v8FBB0d+Y3cp9ubb0DQKBgQD7MiE1QYcnKN6qo9Sk\nYV7dp8w59vShikzMyregQ1UltX4uaS16dnOBKOBPtwyit4sIfGJ2dVT7VaJ+F/X+\nQ1fQtBrWjCT4PRi50NsfidJxh4LomnRb+14/fTb41WhdmBPedcqDgYnzWixST7ew\ncIr4g/ZXNW/0g/czZn9VwbdL6wKBgQDoohlzq/NXMP/2SM3qNB8bCZmVu1692dI5\nhjXkPUv0ug2u9SedhaqA0D5rJhl2G7e7JU75MW1+YghSBX6oUlQQAVkwfrCgsZ8L\nuLWCbQzSZ+gKGrODlL8CwwpESfMjMgDJYAJwiBwhuF/4LGVgNgnEaSHbzuSjR5up\nAbVR7PeSFQKBgHe+QNhLQWsob2S2rmIhzIArQg6Lq7fp3oxtQjWSg19zchAbsUNE\nffEfFDbL0qkqh4tnB+TiL72T597l+yzW22Cwym5l5iWzsjq51grlvzzBVWUeY8OJ\nQzdOsErUKGkdWrNcQUqJEMLBxIkEWVMxgv3OojqWTaUo10lYXfD6ZC87AoGBAKVP\ng3yiRULBbDKsW79BGJWTBdPUGSgaIHyGNceiE1at28lnJqaWdKoi0Sg9I7y9R5uy\nkGMeT6uOqFD43J9qGZhiDOocLRGUBuxCbqFnMsRV2BtODCDF09J3nNUYI7Hv94Ui\nN7mVzz/bED9/9O4gmGI9PzU+2VR6L1AzCZFVLjxdAoGABYk10ndu8iOKeAjHNW8l\n8Maq6SrdfOvJEr1ydAV/uXvPcPfQOhZDHj2jE4sq0T7DiYartuVlK5rCPqKyyqQG\nzjfbsryJtoYAxWGDlefUZbEabsvpUyTg7VQbK+Imi60NwGKaQ9sUOKHFUPE1jc19\nysKbWOj09Y2tOhmpeHG3XM0=\n-----END PRIVATE KEY-----\n",
  }),
});

const db = getFirestore();

async function run() {
  console.log("Fetching all Task documents...");
  const snap = await db.collection("Task").get();
  console.log(`Total tasks: ${snap.size}`);

  const toFix = snap.docs.filter((doc) => doc.data().deletedAt === undefined);
  console.log(`Tasks missing deletedAt: ${toFix.length}`);

  if (toFix.length === 0) {
    console.log("Nothing to fix!");
    return;
  }

  let done = 0;
  for (let i = 0; i < toFix.length; i += 500) {
    const chunk = toFix.slice(i, i + 500);
    const batch = db.batch();
    chunk.forEach((doc) => batch.update(doc.ref, { deletedAt: null }));
    await batch.commit();
    done += chunk.length;
    console.log(`  Patched ${done}/${toFix.length}...`);
  }
  console.log(`\n✅ Done! ${toFix.length} tasks patched.`);
}

run().catch((err) => { console.error(err); process.exit(1); });
