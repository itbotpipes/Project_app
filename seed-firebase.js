/**
 * Firebase Firestore Seed Script
 * Mirrors the original Prisma seed exactly:
 *   - 7 departments, 16 roles, 22 employees
 *   - KPI templates per role
 *   - Historical monthly scores
 *   - Birthdays, announcements, sample tasks
 *
 * Run with:  node seed-firebase.js
 */

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

const DEFAULT_PASSWORD = "password123";
const YEAR = 2025;

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const departments = [
  "Leadership",
  "Accounts",
  "Procurement",
  "Operations",
  "HR & Admin",
  "Design",
  "Engineering",
];

// [title, department, level, isField]
const roles = [
  ["CEO / Director",         "Leadership",  0,  false],
  ["COO",                    "Leadership",  3,  false],
  ["GM",                     "Leadership",  6,  false],
  ["Accounts Manager",       "Accounts",    10, false],
  ["Accountant",             "Accounts",    20, false],
  ["Purchase Manager",       "Procurement", 10, false],
  ["Store Manager",          "Operations",  10, false],
  ["Operations Manager",     "Operations",  10, false],
  ["Project Manager",        "Engineering", 15, true ],
  ["Project Engineer",       "Engineering", 25, true ],
  ["Site Supervisor",        "Engineering", 35, true ],
  ["HR Manager",             "HR & Admin",  10, false],
  ["Admin Officer",          "HR & Admin",  20, false],
  ["NOC & Refilling Manager","Operations",  10, false],
  ["Design Manager",         "Design",      10, false],
  ["Executive",              "Design",      20, false],
];

// [name, roleTitle, systemRole, managerName | null]
const employees = [
  ["Director",      "CEO / Director",          "ADMIN",    null          ],
  ["Cherry",        "COO",                     "CEO",      "Director"    ],
  ["Kishan Dhabi",  "GM",                      "MANAGER",  "Cherry"      ],
  ["Mehul Kothari", "Accounts Manager",        "MANAGER",  "Kishan Dhabi"],
  ["Aditya",        "Accountant",              "EMPLOYEE", "Mehul Kothari"],
  ["Omkar",         "Purchase Manager",        "MANAGER",  "Kishan Dhabi"],
  ["Shree",         "Purchase Manager",        "EMPLOYEE", "Omkar"       ],
  ["Rushi",         "Operations Manager",      "MANAGER",  "Kishan Dhabi"],
  ["Fenil",         "Project Manager",         "MANAGER",  "Rushi"       ],
  ["Yashpal",       "Project Engineer",        "EMPLOYEE", "Fenil"       ],
  ["Avinash",       "Project Engineer",        "EMPLOYEE", "Fenil"       ],
  ["Samarth",       "Project Engineer",        "EMPLOYEE", "Fenil"       ],
  ["Sufiyan",       "Project Engineer",        "EMPLOYEE", "Fenil"       ],
  ["Pankil",        "Project Engineer",        "EMPLOYEE", "Fenil"       ],
  ["Bhagyesh",      "Project Engineer",        "EMPLOYEE", "Fenil"       ],
  ["Yash Chavan",   "Project Engineer",        "EMPLOYEE", "Fenil"       ],
  ["Karthik",       "Project Engineer",        "EMPLOYEE", "Fenil"       ],
  ["Prakash",       "Project Engineer",        "EMPLOYEE", "Fenil"       ],
  ["Chaitali",      "HR Manager",              "MANAGER",  "Kishan Dhabi"],
  ["Pooja",         "Admin Officer",           "EMPLOYEE", "Chaitali"    ],
  ["Priya",         "NOC & Refilling Manager", "MANAGER",  "Kishan Dhabi"],
  ["Pruthvi",       "Design Manager",          "MANAGER",  "Kishan Dhabi"],
  ["Kishan",        "Executive",               "EMPLOYEE", "Pruthvi"     ],
  ["Ajay",          "Executive",               "EMPLOYEE", "Pruthvi"     ],
];

// KPI templates per role: [kra, kpi, weightage, isPrimary]
const kpiTemplates = {
  "Project Engineer": [
    ["Safety Compliance & Toolbox Talks",       "TBT & PPE Compliance",            10, true ],
    ["Project Planning & Milestone Execution",  "Advance Planning & Measurements", 15, true ],
    ["Project Planning & Milestone Execution",  "Measurement Verification",        10, true ],
    ["Project Execution",                       "Parallel Sites Managed",          10, true ],
    ["Material & Inventory Management",         "Advance Material Planning",       15, true ],
    ["Labour & Contractor Management",          "Attendance & Productivity",       10, true ],
    ["Continuous Improvement & Upskilling",     "Trainings / Courses",             3,  false],
    ["Quality Control & Standardisation",       "QC Pass Rate",                    5,  false],
    ["Daily Reporting",                         "100% Daily Reporting",            2,  false],
  ],
  "Project Manager": [
    ["Safety Compliance & Toolbox Talks",       "TBT & PPE Compliance",       10, true ],
    ["Site Engineers Management",               "Delegation & Management",    10, true ],
    ["Project Planning & Milestone Execution",  "Advance Planning",           15, true ],
    ["Project Execution",                       "Parallel Sites Managed",     10, true ],
    ["Material & Inventory Management",         "Advance Material Planning",  15, true ],
    ["Continuous Improvement & Upskilling",     "Trainings / Courses",        2,  false],
    ["Quality Control & Standardisation",       "QC Pass Rate",               2,  false],
    ["Daily Reporting",                         "100% Daily Reporting",       1,  false],
  ],
  "GM": [
    ["Project Execution & Timely Completion", "On-time Completion (Kingpin)",   30, true ],
    ["Cost Overruns",                         "Stay Under Profitability Bar",   10, true ],
    ["Quality & Safety",                      "Zero-incident Culture",          10, true ],
    ["Materials & Procurement",               "No Work Stoppage / DC ≤48h",    10, true ],
    ["Quality Control",                       "First-Time-Pass Rate",           10, true ],
    ["Payment & Measurement Follow-ups",      "On-time Verification",           10, true ],
    ["Client Communication",                  "Query Resolution",               10, false],
    ["Reporting & Documentation",             "Daily/Weekly/Monthly Updates",   5,  false],
    ["Daily Reporting",                       "Site Progress Updates",          5,  false],
  ],
  "Store Manager": [
    ["Inventory Accuracy",              "Software vs Physical Match",      20, true ],
    ["Inward Process",                  "On-time Inward Verification",     10, true ],
    ["Dispatch Timeliness",             "As-per-plan Dispatch",            20, true ],
    ["Daily Reporting",                 "Real-time Stock Report",          10, true ],
    ["Inter-Department Coordination",   "Timely Follow-ups",               10, true ],
    ["Damage/Wastage",                  "Low Wastage (<2%)",               10, true ],
    ["Internal Transfer Documentation", "Challan Raised & Acknowledged",   10, false],
    ["Store Cleanliness & Safety",      "Weekly Compliance",               10, false],
  ],
  "Purchase Manager": [
    ["PO Accuracy",              "POs Signed & Approved",       15, true ],
    ["Vendor Onboarding",        "New Vendors Monthly",         10, true ],
    ["Purchase Master Update",   "Daily Update Consistency",    10, true ],
    ["Bill Handling Accuracy",   "0 Bills at Site/Store",       5,  true ],
    ["Timely PI Follow-Up",      "PI within 7 days",            5,  true ],
    ["Delivery Timeliness",      "Within Committed Date",       20, true ],
    ["Vendor Comparison",        "Quotation Comparison",        5,  false],
    ["Negotiation Savings",      "Cost Saving",                 10, false],
    ["Credit Days Extension",    ">60% vendors 30+ days",       10, false],
    ["Monthly Vendor Report",    "Submitted Monthly",           10, false],
  ],
  "Accountant": [
    ["Daily Sales Billing",       "Same-day Bills",             15, true ],
    ["Purchase Bill Entries",     "Tally within 1 day",         15, true ],
    ["Debit Notes",               "Accurate Creation",          10, true ],
    ["Petty Cash",                "Daily Voucher Entry",         10, true ],
    ["Client Follow-ups",         "First Call within 2 days",   10, true ],
    ["Expense Sheet Management",  "Weekly",                      5,  true ],
    ["Daily Reporting",           "By 6:30 PM",                  5,  true ],
    ["Taxation",                  "TDS / GSTR Filings On-time", 20, false],
    ["Payment Collection",        "1st Call to Clients",         10, false],
  ],
  "Operations Manager": [
    ["Quotations",               "Timely Quotation & Follow-ups", 30, true ],
    ["Sales Inquiries",          "New Inquiry Handling",           10, true ],
    ["Payment Collection",       "Collection Follow-ups",          20, true ],
    ["Measurement Verification", "Within 2 days",                  20, true ],
    ["PO Verification",          "On-time PO Verification",        10, true ],
    ["Contractor Billing",       "Accurate Calculation",           10, false],
    ["Daily Reporting",          "Daily Reporting",                 5,  false],
    ["Quality Standards",        "Monitoring & Ensuring",           5,  false],
    ["Cost Control",             "Optimization",                    5,  false],
    ["Safety Compliance",        "SOPs",                            5,  false],
  ],
  "HR Manager": [
    ["HR",                 "Recruitment / Attendance / Payroll", 20, true ],
    ["Reception",          "Calls & Visitor Management",         20, true ],
    ["Payment Follow-ups", "Follow-ups",                          5,  false],
    ["Follow-ups",         "Efficient Task Follow-ups",          10,  false],
    ["Daily Reporting",    "Daily Reporting",                     5,  false],
  ],
  "NOC & Refilling Manager": [
    ["NOC",                "Timely NOC Approvals & Records",     20, true ],
    ["Refilling Department","Transport & Customer Database",     20, true ],
    ["Reception",          "Calls & Visitor Management",         20, true ],
    ["Payment Follow-ups", "Follow-ups",                          5,  false],
    ["Follow-ups",         "Efficient Task Follow-ups",          10,  false],
    ["Daily Reporting",    "Daily Reporting",                     5,  false],
  ],
};

// Historical monthly totals Jul-Dec 2025
const history = {
  Shree:   [34, 23, 26, 29, null, null],
  Rushi:   [50, 60, 48, 68, 55,   null],
  Fenil:   [26, 13, 17, 34, 38,   null],
  Yashpal: [18, 32, 31, 24, 42,   null],
  Avinash: [17, 16, 21, 20, 31,   null],
};

// Birthdays [month, day]
const birthdays = {
  Chaitali: [7,  12], Yashpal:  [7,  15], Director: [1, 5],
  Cherry:   [3,  22], Fenil:    [9,  2 ], Priya:    [11, 30],
  Shree:    [7,  20], Rushi:    [8,  8 ], Pooja:    [7,  25],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function emailFor(name) {
  const parts = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const slug = (parts.length > 1 ? parts.join(".") : parts[0]).replace(/[^a-z0-9.]/g, "");
  return `${slug}@nse.local`;
}

async function deleteCollection(colName) {
  const snap = await db.collection(colName).limit(200).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  // recurse if there were 200 docs (more might exist)
  if (snap.size === 200) await deleteCollection(colName);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("🔥 Starting Firebase seed...\n");

  // Clear existing data
  console.log("Clearing existing collections...");
  const collections = [
    "Announcement","AuditLog","Reminder","Attachment","TaskComment","Task",
    "WeeklyReflection","DailyRitual","ManagerScore","MonthlyScore",
    "MonthlyScorecard","KpiTemplate","Employee","Role","Department",
    "Project","ProjectExpense","FieldDailyReport","ChecklistItem",
    "TaskWatcher","Group","GroupMember","BirthdayWish","AnnouncementReaction",
    "AnnouncementComment","TaskTemplate","BehaviourReview","YearlyReview",
  ];
  for (const col of collections) {
    await deleteCollection(col);
    process.stdout.write(`  ✓ ${col}\n`);
  }

  // Departments
  console.log("\nCreating departments...");
  const deptMap = new Map();
  for (const name of departments) {
    const ref = db.collection("Department").doc();
    await ref.set({ name, createdAt: new Date() });
    deptMap.set(name, ref.id);
    process.stdout.write(`  ✓ ${name}\n`);
  }

  // Roles
  console.log("\nCreating roles...");
  const roleMap = new Map();
  for (const [title, dept, level, isField] of roles) {
    const ref = db.collection("Role").doc();
    await ref.set({ title, departmentId: deptMap.get(dept), level, isField, createdAt: new Date() });
    roleMap.set(title, ref.id);
    process.stdout.write(`  ✓ ${title}\n`);
  }

  // KPI Templates
  console.log("\nCreating KPI templates...");
  const kpiMap = new Map(); // roleTitle -> [{id, kpiName}]
  for (const [roleTitle, list] of Object.entries(kpiTemplates)) {
    const roleId = roleMap.get(roleTitle);
    if (!roleId) continue;
    const kpisForRole = [];
    for (let i = 0; i < list.length; i++) {
      const [kraName, kpiName, weightage, isPrimary] = list[i];
      const ref = db.collection("KpiTemplate").doc();
      await ref.set({ roleId, kraName, kpiName, weightage, isPrimary, orderIndex: i, createdAt: new Date() });
      kpisForRole.push({ id: ref.id, kpiName });
    }
    kpiMap.set(roleTitle, kpisForRole);
    process.stdout.write(`  ✓ ${roleTitle} (${list.length} KPIs)\n`);
  }

  // Miscellaneous bucket for every role
  console.log("\nAdding Miscellaneous buckets...");
  for (const [title, roleId] of roleMap.entries()) {
    const existing = kpiTemplates[title]?.length ?? 0;
    const ref = db.collection("KpiTemplate").doc();
    await ref.set({
      roleId,
      kraName: "Miscellaneous",
      kpiName: "Miscellaneous / Other",
      weightage: existing > 0 ? 5 : 100,
      isPrimary: false,
      orderIndex: existing,
      createdAt: new Date(),
    });
    if (!kpiMap.has(title)) kpiMap.set(title, []);
    kpiMap.get(title).push({ id: ref.id, kpiName: "Miscellaneous / Other" });
  }

  // Employees
  console.log("\nCreating employees...");
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const empMap = new Map();
  for (const [name, roleTitle, systemRole, managerName] of employees) {
    const ref = db.collection("Employee").doc();
    await ref.set({
      name,
      email: emailFor(name),
      passwordHash,
      roleId: roleMap.get(roleTitle),
      systemRole,
      reportsToId: managerName ? (empMap.get(managerName) ?? null) : null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    empMap.set(name, ref.id);
    process.stdout.write(`  ✓ ${name} (${systemRole})\n`);
  }

  // Birthdays
  console.log("\nAdding birthdays...");
  for (const [name, [mm, dd]] of Object.entries(birthdays)) {
    const id = empMap.get(name);
    if (id) {
      await db.collection("Employee").doc(id).update({
        birthday: new Date(1995, mm - 1, dd),
      });
      process.stdout.write(`  ✓ ${name}: ${mm}/${dd}\n`);
    }
  }

  // Historical scores
  console.log("\nSeeding historical monthly scores...");
  for (const [name, scores] of Object.entries(history)) {
    const empId = empMap.get(name);
    if (!empId) continue;
    for (let idx = 0; idx < scores.length; idx++) {
      const val = scores[idx];
      if (val == null) continue;
      const month = 7 + idx; // Jul = 7
      const ref = db.collection("MonthlyScorecard").doc();
      await ref.set({
        employeeId: empId,
        year: YEAR,
        month,
        total: val,
        autoTotal: val,
        locked: true,
        source: "imported",
        updatedAt: new Date(),
      });
    }
    process.stdout.write(`  ✓ ${name}\n`);
  }

  // Announcements
  console.log("\nCreating announcements...");
  const ceoId = empMap.get("Director");
  await db.collection("Announcement").doc().set({
    kind: "THOUGHT", pinned: true, authorId: ceoId,
    body: "Quality of work matters more than quantity. Finish what's urgent and important first — and update your board before you leave.",
    createdAt: new Date(),
  });
  await db.collection("Announcement").doc().set({
    kind: "NOTICE", authorId: ceoId,
    title: "Monthly review",
    body: "Monthly performance scoring — managers & HR, please complete last month's scores for your team.",
    createdAt: new Date(),
  });
  console.log("  ✓ 2 announcements created");

  // Sample tasks
  console.log("\nCreating sample tasks...");
  const fenilId = empMap.get("Fenil");
  const yashId  = empMap.get("Yashpal");
  const peKpis  = kpiMap.get("Project Engineer") ?? [];
  const findKpi = (substr) => peKpis.find((k) => k.kpiName.includes(substr))?.id ?? null;

  await db.collection("Task").doc().set({
    title: "Create material planning for Shreepad, Florenza",
    description: "Advance material request planning for the week.",
    status: "IN_PROGRESS", sizeLabel: "MEDIUM", urgent: true, important: true,
    estimatedMins: 120, creatorId: fenilId, assigneeId: yashId,
    kpiTemplateId: findKpi("Advance Material"),
    createdAt: new Date(), updatedAt: new Date(),
  });
  await db.collection("Task").doc().set({
    title: "Daily TBT + PPE photos at site",
    status: "NEW", sizeLabel: "EASY", urgent: true, important: true,
    estimatedMins: 30, creatorId: fenilId, assigneeId: yashId,
    kpiTemplateId: findKpi("TBT"),
    createdAt: new Date(), updatedAt: new Date(),
  });
  await db.collection("Task").doc().set({
    title: "Measurement verification at UTC",
    status: "PENDING_REVIEW", sizeLabel: "MEDIUM", urgent: false, important: true,
    estimatedMins: 60, creatorId: fenilId, assigneeId: yashId,
    reviewRequired: true, reviewerId: fenilId,
    kpiTemplateId: findKpi("Measurement Verification"),
    createdAt: new Date(), updatedAt: new Date(),
  });
  console.log("  ✓ 3 sample tasks created");

  // -------------------------------------------------------------------------
  // Projects (Phase 4 feature — schema match from Prisma)
  // -------------------------------------------------------------------------
  console.log("\nCreating sample projects...");
  const proj1Ref = db.collection("Project").doc();
  await proj1Ref.set({
    name: "Shreepad Residency — Electrical Works",
    client: "Shreepad Developers Pvt Ltd",
    salesOrderValue: 2800000,
    status: "ACTIVE",
    startDate: new Date(2025, 5, 1),   // June 2025
    deadline: new Date(2025, 11, 31),  // Dec 2025
    createdAt: new Date(),
  });
  const proj2Ref = db.collection("Project").doc();
  await proj2Ref.set({
    name: "Florenza Heights — Plumbing & Sanitation",
    client: "Florenza Builders",
    salesOrderValue: 1500000,
    status: "ACTIVE",
    startDate: new Date(2025, 6, 15),  // July 2025
    deadline: new Date(2026, 2, 31),   // March 2026
    createdAt: new Date(),
  });
  const proj3Ref = db.collection("Project").doc();
  await proj3Ref.set({
    name: "UTC Tower — Fire Safety Installation",
    client: "UTC Infra Ltd",
    salesOrderValue: 950000,
    status: "ON_HOLD",
    startDate: new Date(2025, 3, 1),   // April 2025
    deadline: new Date(2025, 9, 30),   // Oct 2025
    createdAt: new Date(),
  });
  console.log("  ✓ 3 projects created");

  // -------------------------------------------------------------------------
  // Project Expenses
  // -------------------------------------------------------------------------
  console.log("\nCreating sample project expenses...");
  const fenilId2 = empMap.get("Fenil");
  await db.collection("ProjectExpense").doc().set({
    projectId: proj1Ref.id,
    category: "MATERIAL",
    amount: 125000,
    note: "Wiring & cable drums — Shreepad G+3",
    createdById: fenilId2,
    createdAt: new Date(2025, 6, 10),
  });
  await db.collection("ProjectExpense").doc().set({
    projectId: proj1Ref.id,
    category: "LABOUR",
    amount: 48000,
    note: "Electrician subcontractor — July batch",
    createdById: fenilId2,
    createdAt: new Date(2025, 6, 15),
  });
  await db.collection("ProjectExpense").doc().set({
    projectId: proj2Ref.id,
    category: "MATERIAL",
    amount: 67500,
    note: "CPVC pipes & fittings — Florenza Phase 1",
    createdById: fenilId2,
    createdAt: new Date(2025, 7, 1),
  });
  await db.collection("ProjectExpense").doc().set({
    projectId: proj2Ref.id,
    category: "TRANSPORT",
    amount: 8200,
    note: "Material delivery — Florenza site",
    createdById: fenilId2,
    createdAt: new Date(2025, 7, 3),
  });
  console.log("  ✓ 4 project expenses created");

  // -------------------------------------------------------------------------
  // Field Daily Reports (site team)
  // -------------------------------------------------------------------------
  console.log("\nCreating sample field daily reports...");
  const yashId2  = empMap.get("Yashpal");
  const avinashId = empMap.get("Avinash");
  await db.collection("FieldDailyReport").doc().set({
    employeeId: yashId2,
    date: new Date(2025, 6, 21),  // 21 July 2025
    siteName: "Shreepad Residency — G+3",
    projectId: proj1Ref.id,
    phase: "Electrical rough-in",
    manpower: 8,
    materialUpdate: "Wiring 60% complete on 2nd floor. Cable trays installed.",
    phaseDeadline: new Date(2025, 7, 10),
    siteDeadline: new Date(2025, 11, 31),
    redFlags: null,
    clientUpdatedWA: true,
    tbtDone: true,
    remarks: "Work progressing on schedule. No safety incidents.",
    createdAt: new Date(2025, 6, 21),
  });
  await db.collection("FieldDailyReport").doc().set({
    employeeId: avinashId,
    date: new Date(2025, 6, 21),
    siteName: "Florenza Heights — Tower A",
    projectId: proj2Ref.id,
    phase: "Plumbing — concealed works",
    manpower: 5,
    materialUpdate: "CPVC lines laid on 3rd floor. Pressure test pending.",
    phaseDeadline: new Date(2025, 8, 30),
    siteDeadline: new Date(2026, 2, 31),
    redFlags: "Brick work incomplete on 4th floor — will delay plumbing by ~5 days.",
    clientUpdatedWA: false,
    tbtDone: true,
    remarks: "Coordinating with civil team for 4th floor access.",
    createdAt: new Date(2025, 6, 21),
  });
  await db.collection("FieldDailyReport").doc().set({
    employeeId: yashId2,
    date: new Date(2025, 7, 4),   // 4 Aug 2025
    siteName: "UTC Tower — Fire Safety",
    projectId: proj3Ref.id,
    phase: "Sprinkler installation — B1",
    manpower: 3,
    materialUpdate: "Sprinkler heads delivered. Installation 30% done on B1.",
    phaseDeadline: new Date(2025, 8, 15),
    siteDeadline: new Date(2025, 9, 30),
    redFlags: "Client on hold — awaiting NOC from fire dept.",
    clientUpdatedWA: true,
    tbtDone: true,
    remarks: "Site on pause. Will resume once NOC is received.",
    createdAt: new Date(2025, 7, 4),
  });
  console.log("  ✓ 3 field daily reports created");

  // -------------------------------------------------------------------------
  // Weekly Reflections (Friday 3-question check-in)
  // -------------------------------------------------------------------------
  console.log("\nCreating sample weekly reflections...");
  const rushiId = empMap.get("Rushi");
  // Week of 14 July 2025 (Monday)
  await db.collection("WeeklyReflection").doc().set({
    employeeId: rushiId,
    weekStart: new Date(2025, 6, 14),
    wentWell: "Shreepad material delivery arrived ahead of schedule. Team productivity was high.",
    whatDelayed: "UTC NOC approval is blocked — fire dept visit not confirmed yet.",
    whatImprove: "Need to improve daily reporting consistency from site engineers.",
    createdAt: new Date(2025, 6, 18),
  });
  await db.collection("WeeklyReflection").doc().set({
    employeeId: fenilId2,
    weekStart: new Date(2025, 6, 14),
    wentWell: "All 3 tasks completed on time. Yashpal handled Shreepad measurements independently.",
    whatDelayed: "Florenza 4th floor delay due to civil team.",
    whatImprove: "Better advance coordination with civil contractor before starting a new phase.",
    createdAt: new Date(2025, 6, 18),
  });
  await db.collection("WeeklyReflection").doc().set({
    employeeId: yashId2,
    weekStart: new Date(2025, 7, 4),
    wentWell: "Completed TBT on all 3 sites. Safety record intact.",
    whatDelayed: "UTC site stalled. Nothing to do there until NOC.",
    whatImprove: "Plan alternate productive work for UTC idle days instead of losing hours.",
    createdAt: new Date(2025, 7, 8),
  });
  console.log("  ✓ 3 weekly reflections created");

  // -------------------------------------------------------------------------
  // Manager Scores (holistic human score, separate from KPI auto-scores)
  // -------------------------------------------------------------------------
  console.log("\nCreating sample manager scores...");
  const kishanDhabiId = empMap.get("Kishan Dhabi");
  // Rushi scores his team members for July 2025
  const julyStart = new Date(2025, 6, 1);
  for (const [name, score, note] of [
    ["Fenil",    82, "Strong month — all sites covered, materials planned ahead."],
    ["Yashpal",  76, "Good on TBT, needs improvement on measurement documentation."],
    ["Avinash",  71, "Reliable but slow on Florenza phase 2 handover."],
    ["Samarth",  68, "Missed 2 daily reports. Reminded verbally."],
    ["Pankil",   74, "Steady performance. Improved coordination with store."],
  ]) {
    const empId = empMap.get(name);
    if (!empId) continue;
    await db.collection("ManagerScore").doc().set({
      employeeId: empId,
      ratedById: rushiId,
      period: "MONTHLY",
      periodStart: julyStart,
      score,
      note,
      createdAt: new Date(2025, 7, 2),  // Scored on 2 Aug (after month-end)
      updatedAt: new Date(2025, 7, 2),
    });
  }
  // Kishan Dhabi scores his managers for July 2025
  for (const [name, score, note] of [
    ["Mehul Kothari", 85, "Accounts clean, billing on time, GST filed."],
    ["Omkar",         79, "Good vendor management. 2 POs delayed slightly."],
    ["Rushi",         88, "Excellent site oversight. Team well managed."],
    ["Chaitali",      83, "HR smooth. Payroll error-free. Attendance tracked."],
    ["Priya",         77, "NOC for UTC pending — needs stronger follow-up with fire dept."],
    ["Pruthvi",       81, "Design team productive. Good client feedback on drawings."],
  ]) {
    const empId = empMap.get(name);
    if (!empId) continue;
    await db.collection("ManagerScore").doc().set({
      employeeId: empId,
      ratedById: kishanDhabiId,
      period: "MONTHLY",
      periodStart: julyStart,
      score,
      note,
      createdAt: new Date(2025, 7, 3),
      updatedAt: new Date(2025, 7, 3),
    });
  }
  console.log("  ✓ 11 manager scores created");

  // Summary
  console.log("\n✅ Seed complete!");
  console.log(`   ${departments.length} departments`);
  console.log(`   ${roles.length} roles`);
  console.log(`   ${employees.length} employees`);
  console.log(`   KPI templates for ${Object.keys(kpiTemplates).length} roles`);
  console.log(`   3 projects + 4 project expenses`);
  console.log(`   3 field daily reports`);
  console.log(`   3 weekly reflections`);
  console.log(`   11 manager scores`);
  console.log(`\nLogin with any employee, e.g.`);
  console.log(`   Email:    director@nse.local`);
  console.log(`   Password: ${DEFAULT_PASSWORD}`);
  console.log(`\nOther employees use firstname@nse.local or firstname.lastname@nse.local`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
