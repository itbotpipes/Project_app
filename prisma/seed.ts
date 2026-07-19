/**
 * Seed the app with the company's org structure, KPI templates and any
 * historical monthly scores we have on file.
 * Run with:  npm run seed
 *
 * Org structure below matches the hierarchy chart the COO shared
 * (CEO > COO > GM > 7 department heads > their teams). Roles/people not
 * shown on that chart (Maintenance, Measurement Officers, Design execs,
 * Tendering, etc.) were intentionally dropped from this seed — re-add them
 * via the Admin console once the fuller roster sheet is shared. KPI
 * templates for roles that already had real KPI data are preserved as-is;
 * roles new to this chart (Design Manager, Executive, Site Supervisor) only
 * get a placeholder "Miscellaneous" bucket until their real KPIs are supplied.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "password123";
const YEAR = 2025;

// ---------------------------------------------------------------------------
// Departments & roles
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

// title, department, level (lower = senior), isField
const roles: [string, string, number, boolean][] = [
  ["CEO / Director", "Leadership", 0, false],
  ["COO", "Leadership", 3, false],
  ["GM", "Leadership", 6, false],
  ["Accounts Manager", "Accounts", 10, false],
  ["Accountant", "Accounts", 20, false],
  ["Purchase Manager", "Procurement", 10, false],
  ["Store Manager", "Operations", 10, false],
  ["Operations Manager", "Operations", 10, false],
  ["Project Manager", "Engineering", 15, true],
  ["Project Engineer", "Engineering", 25, true],
  ["Site Supervisor", "Engineering", 35, true],
  ["HR Manager", "HR & Admin", 10, false],
  ["Admin Officer", "HR & Admin", 20, false],
  ["NOC & Refilling Manager", "Operations", 10, false],
  ["Design Manager", "Design", 10, false],
  ["Executive", "Design", 20, false],
];

// name, roleTitle, systemRole, managerName (null = top)
const employees: [string, string, string, string | null][] = [
  ["Director", "CEO / Director", "ADMIN", null],
  ["Cherry", "COO", "CEO", "Director"],
  ["Kishan Dhabi", "GM", "MANAGER", "Cherry"],

  ["Mehul Kothari", "Accounts Manager", "MANAGER", "Kishan Dhabi"],
  ["Aditya", "Accountant", "EMPLOYEE", "Mehul Kothari"],

  ["Omkar", "Purchase Manager", "MANAGER", "Kishan Dhabi"],
  ["Shree", "Purchase Manager", "EMPLOYEE", "Omkar"],

  // Store Manager: vacant — no name on the chart yet
  ["Rushi", "Operations Manager", "MANAGER", "Kishan Dhabi"],
  ["Fenil", "Project Manager", "MANAGER", "Rushi"],
  ["Yashpal", "Project Engineer", "EMPLOYEE", "Fenil"],
  ["Avinash", "Project Engineer", "EMPLOYEE", "Fenil"],
  ["Samarth", "Project Engineer", "EMPLOYEE", "Fenil"],
  ["Sufiyan", "Project Engineer", "EMPLOYEE", "Fenil"],
  ["Pankil", "Project Engineer", "EMPLOYEE", "Fenil"],
  ["Bhagyesh", "Project Engineer", "EMPLOYEE", "Fenil"],
  ["Yash Chavan", "Project Engineer", "EMPLOYEE", "Fenil"],
  ["Karthik", "Project Engineer", "EMPLOYEE", "Fenil"],
  ["Prakash", "Project Engineer", "EMPLOYEE", "Fenil"],
  // Site Supervisor: vacant — no name on the chart yet

  ["Chaitali", "HR Manager", "MANAGER", "Kishan Dhabi"],
  ["Pooja", "Admin Officer", "EMPLOYEE", "Chaitali"],

  ["Priya", "NOC & Refilling Manager", "MANAGER", "Kishan Dhabi"],

  ["Pruthvi", "Design Manager", "MANAGER", "Kishan Dhabi"],
  ["Kishan", "Executive", "EMPLOYEE", "Pruthvi"],
  ["Ajay", "Executive", "EMPLOYEE", "Pruthvi"],
];

/** firstname@ for single-word names; firstname.lastname@ for multi-word (avoids collisions, e.g. "Kishan" vs "Kishan Dhabi"). */
function emailFor(name: string) {
  const parts = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const slug = (parts.length > 1 ? parts.join(".") : parts[0]).replace(/[^a-z0-9.]/g, "");
  return `${slug}@nse.local`;
}

// ---------------------------------------------------------------------------
// KPI templates per role (kra, kpi, weightage, isPrimary)
// Preserved from the source spreadsheets for roles that had real KPI data.
// ---------------------------------------------------------------------------
const kpiTemplates: Record<string, [string, string, number, boolean][]> = {
  "Project Engineer": [
    ["Safety Compliance & Toolbox Talks", "TBT & PPE Compliance", 10, true],
    ["Project Planning & Milestone Execution", "Advance Planning & Measurements", 15, true],
    ["Project Planning & Milestone Execution", "Measurement Verification", 10, true],
    ["Project Execution", "Parallel Sites Managed", 10, true],
    ["Material & Inventory Management", "Advance Material Planning", 15, true],
    ["Labour & Contractor Management", "Attendance & Productivity", 10, true],
    ["Continuous Improvement & Upskilling", "Trainings / Courses", 3, false],
    ["Quality Control & Standardisation", "QC Pass Rate", 5, false],
    ["Daily Reporting", "100% Daily Reporting", 2, false],
  ],
  "Project Manager": [
    ["Safety Compliance & Toolbox Talks", "TBT & PPE Compliance", 10, true],
    ["Site Engineers Management", "Delegation & Management", 10, true],
    ["Project Planning & Milestone Execution", "Advance Planning", 15, true],
    ["Project Execution", "Parallel Sites Managed", 10, true],
    ["Material & Inventory Management", "Advance Material Planning", 15, true],
    ["Continuous Improvement & Upskilling", "Trainings / Courses", 2, false],
    ["Quality Control & Standardisation", "QC Pass Rate", 2, false],
    ["Daily Reporting", "100% Daily Reporting", 1, false],
  ],
  GM: [
    ["Project Execution & Timely Completion", "On-time Completion (Kingpin)", 30, true],
    ["Cost Overruns", "Stay Under Profitability Bar", 10, true],
    ["Quality & Safety", "Zero-incident Culture", 10, true],
    ["Materials & Procurement", "No Work Stoppage / DC ≤48h", 10, true],
    ["Quality Control", "First-Time-Pass Rate", 10, true],
    ["Payment & Measurement Follow-ups", "On-time Verification", 10, true],
    ["Client Communication", "Query Resolution", 10, false],
    ["Reporting & Documentation", "Daily/Weekly/Monthly Updates", 5, false],
    ["Daily Reporting", "Site Progress Updates", 5, false],
  ],
  "Store Manager": [
    ["Inventory Accuracy", "Software vs Physical Match", 20, true],
    ["Inward Process", "On-time Inward Verification", 10, true],
    ["Dispatch Timeliness", "As-per-plan Dispatch", 20, true],
    ["Daily Reporting", "Real-time Stock Report", 10, true],
    ["Inter-Department Coordination", "Timely Follow-ups", 10, true],
    ["Damage/Wastage", "Low Wastage (<2%)", 10, true],
    ["Internal Transfer Documentation", "Challan Raised & Acknowledged", 10, false],
    ["Store Cleanliness & Safety", "Weekly Compliance", 10, false],
  ],
  "Purchase Manager": [
    ["PO Accuracy", "POs Signed & Approved", 15, true],
    ["Vendor Onboarding", "New Vendors Monthly", 10, true],
    ["Purchase Master Update", "Daily Update Consistency", 10, true],
    ["Bill Handling Accuracy", "0 Bills at Site/Store", 5, true],
    ["Timely PI Follow-Up", "PI within 7 days", 5, true],
    ["Delivery Timeliness", "Within Committed Date", 20, true],
    ["Vendor Comparison", "Quotation Comparison", 5, false],
    ["Negotiation Savings", "Cost Saving", 10, false],
    ["Credit Days Extension", ">60% vendors 30+ days", 10, false],
    ["Monthly Vendor Report", "Submitted Monthly", 10, false],
  ],
  Accountant: [
    ["Daily Sales Billing", "Same-day Bills", 15, true],
    ["Purchase Bill Entries", "Tally within 1 day", 15, true],
    ["Debit Notes", "Accurate Creation", 10, true],
    ["Petty Cash", "Daily Voucher Entry", 10, true],
    ["Client Follow-ups", "First Call within 2 days", 10, true],
    ["Expense Sheet Management", "Weekly", 5, true],
    ["Daily Reporting", "By 6:30 PM", 5, true],
    ["Taxation", "TDS / GSTR Filings On-time", 20, false],
    ["Payment Collection", "1st Call to Clients", 10, false],
  ],
  "Operations Manager": [
    ["Quotations", "Timely Quotation & Follow-ups", 30, true],
    ["Sales Inquiries", "New Inquiry Handling", 10, true],
    ["Payment Collection", "Collection Follow-ups", 20, true],
    ["Measurement Verification", "Within 2 days", 20, true],
    ["PO Verification", "On-time PO Verification", 10, true],
    ["Contractor Billing", "Accurate Calculation", 10, false],
    ["Daily Reporting", "Daily Reporting", 5, false],
    ["Quality Standards", "Monitoring & Ensuring", 5, false],
    ["Cost Control", "Optimization", 5, false],
    ["Safety Compliance", "SOPs", 5, false],
  ],
  "HR Manager": [
    ["HR", "Recruitment / Attendance / Payroll", 20, true],
    ["Reception", "Calls & Visitor Management", 20, true],
    ["Payment Follow-ups", "Follow-ups", 5, false],
    ["Follow-ups", "Efficient Task Follow-ups", 10, false],
    ["Daily Reporting", "Daily Reporting", 5, false],
  ],
  "NOC & Refilling Manager": [
    ["NOC", "Timely NOC Approvals & Records", 20, true],
    ["Refilling Department", "Transport & Customer Database", 20, true],
    ["Reception", "Calls & Visitor Management", 20, true],
    ["Payment Follow-ups", "Follow-ups", 5, false],
    ["Follow-ups", "Efficient Task Follow-ups", 10, false],
    ["Daily Reporting", "Daily Reporting", 5, false],
  ],
};

// ---------------------------------------------------------------------------
// Historical monthly totals we can carry over with continuity
// (people whose name AND role are unchanged from prior data)
// ---------------------------------------------------------------------------
const history: Record<string, (number | null)[]> = {
  //       Jul   Aug   Sep   Oct   Nov   Dec
  Shree:  [ 34,   23,   26,   29, null, null],
  Rushi:  [ 50,   60,   48,   68,   55, null],
  Fenil:  [ 26,   13,   17,   34,   38, null],
  Yashpal:[ 18,   32,   31,   24,   42, null],
  Avinash:[ 17,   16,   21,   20,   31, null],
};

const birthdays: Record<string, [number, number]> = {
  Chaitali: [7, 12], Yashpal: [7, 15], Director: [1, 5],
  Cherry: [3, 22], Fenil: [9, 2], Priya: [11, 30], Shree: [7, 20],
  Rushi: [8, 8], Pooja: [7, 25],
};

async function main() {
  console.log("Clearing existing data…");
  await prisma.announcement.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.weeklyReflection.deleteMany();
  await prisma.dailyRitual.deleteMany();
  await prisma.fieldDailyReport.deleteMany();
  await prisma.managerScore.deleteMany();
  await prisma.monthlyScore.deleteMany();
  await prisma.monthlyScorecard.deleteMany();
  await prisma.kpiTemplate.deleteMany();
  await prisma.projectExpense.deleteMany();
  await prisma.project.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.role.deleteMany();
  await prisma.department.deleteMany();

  console.log("Departments…");
  const deptMap = new Map<string, string>();
  for (const name of departments) {
    const d = await prisma.department.create({ data: { name } });
    deptMap.set(name, d.id);
  }

  console.log("Roles…");
  const roleMap = new Map<string, string>();
  for (const [title, dept, level, isField] of roles) {
    const r = await prisma.role.create({
      data: { title, departmentId: deptMap.get(dept), level, isField },
    });
    roleMap.set(title, r.id);
  }

  console.log("KPI templates…");
  for (const [roleTitle, list] of Object.entries(kpiTemplates)) {
    const roleId = roleMap.get(roleTitle);
    if (!roleId) continue;
    let i = 0;
    for (const [kra, kpi, weightage, isPrimary] of list) {
      await prisma.kpiTemplate.create({
        data: { roleId, kraName: kra, kpiName: kpi, weightage, isPrimary, orderIndex: i++ },
      });
    }
  }

  console.log("Miscellaneous bucket for every role…");
  for (const [title, roleId] of roleMap.entries()) {
    const existing = kpiTemplates[title]?.length ?? 0;
    await prisma.kpiTemplate.create({
      data: {
        roleId,
        kraName: "Miscellaneous",
        kpiName: "Miscellaneous / Other",
        weightage: existing > 0 ? 5 : 100,
        isPrimary: false,
        orderIndex: existing,
      },
    });
  }

  console.log("Employees…");
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const empMap = new Map<string, string>();
  // create in listed order so managers exist before reports
  for (const [name, roleTitle, systemRole, managerName] of employees) {
    const e = await prisma.employee.create({
      data: {
        name,
        email: emailFor(name),
        passwordHash,
        roleId: roleMap.get(roleTitle)!,
        systemRole,
        reportsToId: managerName ? empMap.get(managerName) ?? null : null,
      },
    });
    empMap.set(name, e.id);
  }

  console.log("Historical scores…");
  for (const [name, scores] of Object.entries(history)) {
    const empId = empMap.get(name);
    if (!empId) continue;
    for (let idx = 0; idx < scores.length; idx++) {
      const val = scores[idx];
      if (val == null) continue;
      const month = 7 + idx; // Jul = 7
      await prisma.monthlyScorecard.create({
        data: { employeeId: empId, year: YEAR, month, total: val, locked: true, source: "imported" },
      });
    }
  }

  console.log("Birthdays…");
  for (const [name, [mm, dd]] of Object.entries(birthdays)) {
    const id = empMap.get(name);
    if (id) await prisma.employee.update({ where: { id }, data: { birthday: new Date(1995, mm - 1, dd) } });
  }

  console.log("Announcements…");
  const ceo = empMap.get("Director")!;
  await prisma.announcement.create({
    data: {
      kind: "THOUGHT", pinned: true, authorId: ceo,
      body: "Quality of work matters more than quantity. Finish what's urgent and important first — and update your board before you leave.",
    },
  });
  await prisma.announcement.create({
    data: {
      kind: "NOTICE", authorId: ceo,
      title: "Monthly review",
      body: "Monthly performance scoring — managers &amp; HR, please complete last month's scores for your team.",
    },
  });

  console.log("A few sample tasks…");
  const fenil = empMap.get("Fenil")!;
  const yash = empMap.get("Yashpal")!;
  const peKpis = await prisma.kpiTemplate.findMany({ where: { role: { title: "Project Engineer" } } });
  const findKpi = (name: string) => peKpis.find((k) => k.kpiName.includes(name))?.id;

  await prisma.task.create({
    data: {
      title: "Create material planning for Shreepad, Florenza",
      description: "Advance material request planning for the week.",
      status: "IN_PROGRESS", sizeLabel: "MEDIUM", urgent: true, important: true,
      estimatedMins: 120, creatorId: fenil, assigneeId: yash,
      kpiTemplateId: findKpi("Advance Material"),
    },
  });
  await prisma.task.create({
    data: {
      title: "Daily TBT + PPE photos at site",
      status: "NEW", sizeLabel: "EASY", urgent: true, important: true,
      estimatedMins: 30, creatorId: fenil, assigneeId: yash,
      kpiTemplateId: findKpi("TBT"),
    },
  });
  await prisma.task.create({
    data: {
      title: "Measurement verification at UTC",
      status: "PENDING_REVIEW", sizeLabel: "MEDIUM", urgent: false, important: true,
      estimatedMins: 60, creatorId: fenil, assigneeId: yash, reviewRequired: true, reviewerId: fenil,
      kpiTemplateId: findKpi("Measurement Verification"),
    },
  });

  const counts = {
    departments: await prisma.department.count(),
    roles: await prisma.role.count(),
    employees: await prisma.employee.count(),
    kpiTemplates: await prisma.kpiTemplate.count(),
    scorecards: await prisma.monthlyScorecard.count(),
    tasks: await prisma.task.count(),
  };
  console.log("Seed complete:", counts);
  console.log(`\nLogin with any employee, e.g.  director@nse.local  /  ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
