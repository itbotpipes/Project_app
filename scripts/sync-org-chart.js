require("dotenv").config({ path: ".env.local" });
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const bcrypt = require("bcryptjs");

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore();

async function main() {
  console.log("=== Syncing Northern Star Engineering Org Structure (Headcount 33) ===");

  // 1. Departments definition
  const targetDepartments = [
    "Leadership",
    "Site Execution",
    "Operations AMC / Refilling",
    "Measurement",
    "Design",
    "Purchase",
    "Accounts & Finance",
    "HR & Admin",
    "Marketing",
  ];

  const deptSnap = await db.collection("Department").get();
  const deptMap = new Map(); // name.toLowerCase() -> id
  deptSnap.docs.forEach((d) => deptMap.set(d.data().name.toLowerCase().trim(), d.id));

  for (const name of targetDepartments) {
    const key = name.toLowerCase().trim();
    if (!deptMap.has(key)) {
      const docRef = await db.collection("Department").add({ name, createdAt: new Date() });
      deptMap.set(key, docRef.id);
      console.log(`Created Department: "${name}" (${docRef.id})`);
    } else {
      // update proper casing if needed
      await db.collection("Department").doc(deptMap.get(key)).update({ name });
      console.log(`Found Department: "${name}" (${deptMap.get(key)})`);
    }
  }

  // 2. Roles definition: [title, deptName, level]
  const targetRoles = [
    ["CEO / MD", "Leadership", 0],
    ["COO", "Leadership", 5],
    ["General Manager", "Leadership", 10],
    ["Operation Manager", "Operations AMC / Refilling", 12],
    ["Site Engineer", "Site Execution", 30],
    ["Safety Supervisor", "Site Execution", 35],
    ["Site Supervisor", "Site Execution", 40],
    ["Asst. Operation Manager", "Operations AMC / Refilling", 20],
    ["Maintenance Supervisor", "Operations AMC / Refilling", 35],
    ["Maintenance Technician", "Operations AMC / Refilling", 50],
    ["Measurement Assistant", "Measurement", 45],
    ["Design Engineer", "Design", 35],
    ["Design Intern", "Design", 60],
    ["Purchase Manager", "Purchase", 25],
    ["Senior Accountant", "Accounts & Finance", 25],
    ["Junior Accountant", "Accounts & Finance", 45],
    ["Accounts Intern", "Accounts & Finance", 60],
    ["HR Manager", "HR & Admin", 25],
    ["Admin - Back Office", "HR & Admin", 45],
    ["MIS / Management Assistant", "HR & Admin", 50],
    ["Social Media Manager", "Marketing", 35],
    ["Social Media Coordinator", "Marketing", 45],
  ];

  const roleSnap = await db.collection("Role").get();
  const roleMap = new Map(); // title.toLowerCase() -> id
  roleSnap.docs.forEach((r) => roleMap.set(r.data().title.toLowerCase().trim(), r.id));

  for (const [title, deptName, level] of targetRoles) {
    const key = title.toLowerCase().trim();
    const deptId = deptMap.get(deptName.toLowerCase().trim());
    if (!roleMap.has(key)) {
      const rRef = await db.collection("Role").add({ title, departmentId: deptId, level, isField: false, createdAt: new Date() });
      roleMap.set(key, rRef.id);
      console.log(`Created Role: "${title}" (${rRef.id})`);
    } else {
      await db.collection("Role").doc(roleMap.get(key)).update({ title, departmentId: deptId, level });
      console.log(`Updated Role: "${title}" (${roleMap.get(key)})`);
    }
  }

  // 3. Employee hierarchy specs (33 members)
  // [key, name, email, roleTitle, deptName, systemRole, managerKey]
  const targetEmployees = [
    // Leadership Root
    ["chinmay", "Chinmay Desai", "director@nse.local", "CEO / MD", "Leadership", "ADMIN", null],
    ["cherry", "Cherry Chandak", "cherry@nse.local", "COO", "Leadership", "ADMIN", "chinmay"],

    // Direct Reports to Cherry
    ["kishan_dabhi", "Kishan Dabhi", "kishan.dabhi@nse.local", "General Manager", "Site Execution", "MANAGER", "cherry"],
    ["rushi", "Rushi Degdawala", "rushi@nse.local", "Operation Manager", "Operations AMC / Refilling", "MANAGER", "cherry"],

    // Branch 1: Site Execution (07 members under Kishan Dabhi)
    ["prakash", "Prakash Patel", "prakash@nse.local", "Site Engineer", "Site Execution", "EMPLOYEE", "kishan_dabhi"],
    ["yashpal", "Yashpal Gohil", "yashpal@nse.local", "Safety Supervisor", "Site Execution", "EMPLOYEE", "kishan_dabhi"],
    ["pankil", "Pankil Saraiya", "pankil@nse.local", "Site Supervisor", "Site Execution", "EMPLOYEE", "kishan_dabhi"],
    ["avinash", "Avinash Sadanshiv", "avinash@nse.local", "Site Supervisor", "Site Execution", "EMPLOYEE", "kishan_dabhi"],
    ["yash_chavan", "Yash Chavan", "yash.chavan@nse.local", "Site Supervisor", "Site Execution", "EMPLOYEE", "kishan_dabhi"],
    ["kartik", "Kartik Singh", "kartik@nse.local", "Site Supervisor", "Site Execution", "EMPLOYEE", "kishan_dabhi"],
    ["mayur", "Mayur Patil", "mayur@nse.local", "Site Supervisor", "Site Execution", "EMPLOYEE", "kishan_dabhi"],

    // Branch 2: Operations AMC / Refilling (03 members under Rushi)
    ["vishal", "Vishal Pandey", "vishal@nse.local", "Asst. Operation Manager", "Operations AMC / Refilling", "MANAGER", "rushi"],
    ["bhavesh", "Bhavesh Patil", "bhavesh@nse.local", "Maintenance Supervisor", "Operations AMC / Refilling", "EMPLOYEE", "vishal"],
    ["adil", "Adil Ansari", "adil@nse.local", "Maintenance Technician", "Operations AMC / Refilling", "EMPLOYEE", "bhavesh"],

    // Branch 3: Measurement (02 members under Rushi)
    ["axay", "Axaykumar Patel", "axay@nse.local", "Measurement Assistant", "Measurement", "EMPLOYEE", "rushi"],
    ["shyam", "Shaym Solanki", "shyam@nse.local", "Measurement Assistant", "Measurement", "EMPLOYEE", "rushi"],

    // Branch 4: Design (06 members under Rushi)
    ["pruthvi", "Pruthvi Kothari", "pruthvi@nse.local", "Design Engineer", "Design", "MANAGER", "rushi"],
    ["kishan_parmar", "Kishan Parmar", "kishan@nse.local", "Design Engineer", "Design", "EMPLOYEE", "pruthvi"],
    ["ajay", "Ajay", "ajay@nse.local", "Design Engineer", "Design", "EMPLOYEE", "pruthvi"],
    ["sheel", "Sheel Galchar", "sheel@nse.local", "Design Engineer", "Design", "EMPLOYEE", "pruthvi"],
    ["jaimin", "Jaimin Patel", "jaimin@nse.local", "Design Engineer", "Design", "EMPLOYEE", "pruthvi"],
    ["horens", "Horens", "horens@nse.local", "Design Intern", "Design", "EMPLOYEE", "pruthvi"],

    // Branch 5: Purchase (02 members under Rushi)
    ["shree", "ShreeKrushna Sharma", "shree@nse.local", "Purchase Manager", "Purchase", "MANAGER", "rushi"],
    ["omkar", "Omkar Telang", "omkar@nse.local", "Purchase Manager", "Purchase", "MANAGER", "rushi"],

    // Branch 6: Accounts & Finance (03 members under Rushi)
    ["mehul", "Mehul Kothari", "mehul.kothari@nse.local", "Senior Accountant", "Accounts & Finance", "MANAGER", "rushi"],
    ["aditya", "Aditya Rastogi", "aditya@nse.local", "Junior Accountant", "Accounts & Finance", "EMPLOYEE", "mehul"],
    ["aayush", "Aayush", "aayush@nse.local", "Accounts Intern", "Accounts & Finance", "EMPLOYEE", "mehul"],

    // Branch 7: HR & Admin (04 members under Rushi)
    ["chaitali", "Chaitali Gandhi", "chaitali@nse.local", "HR Manager", "HR & Admin", "MANAGER", "rushi"],
    ["priya", "Priya Nishad", "priya@nse.local", "Admin - Back Office", "HR & Admin", "EMPLOYEE", "chaitali"],
    ["pooja", "Pooja Kevat", "pooja@nse.local", "Admin - Back Office", "HR & Admin", "EMPLOYEE", "chaitali"],
    ["trisha", "Trisha Kinariwala", "trisha@nse.local", "MIS / Management Assistant", "HR & Admin", "EMPLOYEE", "chaitali"],

    // Branch 8: Marketing (02 members connected to Chaitali / HR)
    ["nupur", "Nupur Baheti", "nupur@nse.local", "Social Media Manager", "Marketing", "EMPLOYEE", "chaitali"],
    ["mohit", "Mohit Shah", "mohit@nse.local", "Social Media Coordinator", "Marketing", "EMPLOYEE", "nupur"],
  ];

  console.log(`Targeting exactly ${targetEmployees.length} employees.`);

  // Mapping known existing IDs to employee keys
  const knownIdMap = {
    chinmay: "BE5AqciZ7NDD9lC34s9Z",
    cherry: "fN5EEBQet6gCJmSGpGkQ",
    kishan_dabhi: "kYf59QHJJHk0Y8N1eOgf",
    rushi: "NUwRO5kWOuaCwM9fQe8K",
    prakash: "NwGl7EJ8Uxnh7YbIh17p",
    yashpal: "Z2zgmzU8JvNyKRQFIciW",
    pankil: "MJw1JhL5mP188iHijNst",
    avinash: "BlkK1w3NGJlbSk2RFwlr",
    yash_chavan: "nAKz2YZEaWMQIcqwSMtM",
    kartik: "ovsLpg1RkKQxDtOFKoAI",
    vishal: "bccaVlIWAPa4v2aEaW6b",
    bhavesh: "Qb08AploRgqGNxsy6xfp",
    adil: "RF0swZJhlNXhjwPCPFdA",
    axay: "UnRSOBmoZ1awqdUQh4vk",
    shyam: "KouNIjtqQcI2L8QF1HJN",
    pruthvi: "v6CnoHvxIqsQSUWC4YET",
    kishan_parmar: "B1cnXvpLe8Wdtq6UzvJT",
    ajay: "cV1Ndtf5KJ9Dr81cc2xj",
    sheel: "I3XwD87m16dSdTzZmZXd",
    jaimin: "IX9G39MCC3fhhPzXzzf6",
    shree: "4iT7B35imvxyg4eVGthY",
    omkar: "b4uFY0DEbPybn6T3csKq",
    mehul: "JHHrMOpotlwqadNe8FVY",
    aditya: "T1jwQJvJeOaUmkPkVvnY",
    chaitali: "IqECXTGdbZ3moCP4jqCO",
    priya: "3a8dtz4WbLZ5ZGKAaEEs",
    pooja: "zNhI0SurQfJhXa8g0Dtj",
    trisha: "2A5h4WpWzB8cktwD5ONj",
    nupur: "NhyM6OGgPRDoULDpvIUw",
    mohit: "3Pf7FmtPi1CESvg4ZnKS",
  };

  const keyToDocId = new Map();

  // First pass: create or find IDs for each employee
  const existingSnap = await db.collection("Employee").get();
  const existingByEmail = new Map();
  const existingByName = new Map();
  existingSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.email) existingByEmail.set(data.email.toLowerCase().trim(), d.id);
    if (data.name) existingByName.set(data.name.toLowerCase().trim(), d.id);
  });

  const defaultHash = await bcrypt.hash("password123", 10);

  for (const [key, name, email] of targetEmployees) {
    let docId = knownIdMap[key];
    if (!docId && existingByEmail.has(email.toLowerCase().trim())) {
      docId = existingByEmail.get(email.toLowerCase().trim());
    }
    if (!docId && existingByName.has(name.toLowerCase().trim())) {
      docId = existingByName.get(name.toLowerCase().trim());
    }

    if (!docId) {
      // Create new employee document
      const newRef = await db.collection("Employee").add({
        name,
        email,
        passwordHash: defaultHash,
        active: true,
        createdAt: new Date(),
      });
      docId = newRef.id;
      console.log(`Created new employee: ${name} (${docId})`);
    }

    keyToDocId.set(key, docId);
  }

  // Second pass: update each employee with exact role, department, manager relations, active: true
  const activeIds = new Set(keyToDocId.values());

  for (const [key, name, email, roleTitle, deptName, systemRole, managerKey] of targetEmployees) {
    const docId = keyToDocId.get(key);
    const roleId = roleMap.get(roleTitle.toLowerCase().trim()) || null;
    const departmentId = deptMap.get(deptName.toLowerCase().trim()) || null;
    const reportsToId = managerKey ? keyToDocId.get(managerKey) || null : null;
    const reportsToIds = reportsToId ? [reportsToId] : [];

    await db.collection("Employee").doc(docId).set(
      {
        name,
        email,
        roleId,
        departmentId,
        reportsToId,
        reportsToIds,
        systemRole,
        active: true,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    console.log(`✓ Updated [${name}] -> Role: "${roleTitle}", Dept: "${deptName}", Reports to: ${managerKey || "none"}`);
  }

  // Third pass: deactivate any employees not part of the 33 headcount
  for (const doc of existingSnap.docs) {
    if (!activeIds.has(doc.id)) {
      await db.collection("Employee").doc(doc.id).update({
        active: false,
        updatedAt: new Date(),
      });
      console.log(`Deactivated legacy/test employee: ${doc.data().name} (${doc.id})`);
    }
  }

  const finalActiveSnap = await db.collection("Employee").where("active", "==", true).get();
  console.log(`\n=== SYNC COMPLETE! Final Active Headcount: ${finalActiveSnap.size} ===`);
  finalActiveSnap.docs.forEach((d) => {
    console.log(`• ${d.data().name} (Role ID: ${d.data().roleId}, Reports to: ${d.data().reportsToId})`);
  });
}

main().catch(console.error);
