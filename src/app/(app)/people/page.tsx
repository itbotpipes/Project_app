import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { fetchAllRoles, fetchAllDepartments } from "@/lib/cache";
import DirectoryView, { type DirectoryEmployee } from "./DirectoryView";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; date?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const rawMonth = sp.month || sp.date;

  // Parse month param or default to current / previous month
  const now = new Date();
  let selectedDate = now;
  if (rawMonth) {
    const parts = rawMonth.split("-");
    if (parts.length >= 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      if (!isNaN(y) && !isNaN(m)) {
        selectedDate = new Date(y, m, 1);
      }
    }
  }

  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth() + 1;
  const selectedMonthValue = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  const selectedMonthLabel = selectedDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  // Generate list of available months (last 12 months)
  const availableMonths: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const lbl = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    availableMonths.push({ value: val, label: lbl });
  }

  // Fetch employees, roles, departments, managers, and scorecards
  const [employeesSnap, rolesSnap, departmentsSnap, scorecardsSnap, allEmpsSnap] = await Promise.all([
    adminDb.collection("Employee").where("active", "==", true).get(),
    fetchAllRoles(adminDb),
    fetchAllDepartments(adminDb),
    adminDb.collection("MonthlyScorecard").get(),
    adminDb.collection("Employee").get(),
  ]);

  // Build lookup maps
  const rolesMap = new Map<string, any>();
  rolesSnap.docs?.forEach((d: any) => rolesMap.set(d.id, d.data()));

  const deptsMap = new Map<string, any>();
  departmentsSnap.docs?.forEach((d: any) => deptsMap.set(d.id, d.data().name));

  const allEmpsMap = new Map<string, any>();
  allEmpsSnap.docs?.forEach((d: any) => allEmpsMap.set(d.id, d.data().name));

  // Group scorecards by employee
  const scorecardsByEmp = new Map<string, any[]>();
  scorecardsSnap.docs?.forEach((doc: any) => {
    const data = doc.data();
    const empId = data.employeeId;
    if (!scorecardsByEmp.has(empId)) scorecardsByEmp.set(empId, []);
    scorecardsByEmp.get(empId)!.push(data);
  });

  // Build employee list for directory (single unified list, no hierarchy headers)
  const directoryEmployees: DirectoryEmployee[] = (employeesSnap.docs || []).map((doc: any) => {
    const data = doc.data();
    const empId = doc.id;
    const role = data.roleId ? rolesMap.get(data.roleId) : null;
    const departmentName = role?.departmentId ? (deptsMap.get(role.departmentId) || "General") : "General";

    // Manager name
    const mgrIds = data.reportsToIds || (data.reportsToId ? [data.reportsToId] : []);
    const mgrNames = mgrIds.map((id: string) => allEmpsMap.get(id)).filter(Boolean);
    const managerName = mgrNames.length > 0 ? mgrNames.join(", ") : "—";

    // Scorecards up to selected period
    const empCards = scorecardsByEmp.get(empId) || [];
    const validCards = empCards
      .filter((c: any) => c.year < selectedYear || (c.year === selectedYear && c.month <= selectedMonth))
      .sort((a: any, b: any) => (a.year - b.year) || (a.month - b.month));

    // Last 6 months scorecards
    const last6 = validCards.slice(-6);
    const avg6Months = last6.length > 0
      ? Math.round((last6.reduce((sum: number, c: any) => sum + (c.total || 0), 0) / last6.length) * 10) / 10
      : 0;

    // Selected month score
    const monthCard = empCards.find((c: any) => c.year === selectedYear && c.month === selectedMonth);
    const monthScore = monthCard ? monthCard.total : null;
    const monthAutoScore = monthCard ? monthCard.autoTotal : null;

    // Calculate Expected Increment based on 6-month average consistency
    let increment: DirectoryEmployee["increment"];
    if (avg6Months >= 85) {
      increment = { pct: 20, label: "+20% Bonus", tier: "TOP", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    } else if (avg6Months >= 75) {
      increment = { pct: 15, label: "+15% Bonus", tier: "HIGH", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    } else if (avg6Months >= 65) {
      increment = { pct: 10, label: "+10% Increment", tier: "STANDARD", tone: "bg-blue-50 text-blue-700 border-blue-200" };
    } else if (avg6Months >= 45) {
      increment = { pct: 5, label: "+5% Increment", tier: "LOW", tone: "bg-amber-50 text-amber-700 border-amber-200" };
    } else if (avg6Months > 0) {
      increment = { pct: 0, label: "0% / Below Threshold", tier: "NONE", tone: "bg-slate-50 text-slate-500 border-slate-200" };
    } else {
      increment = { pct: 0, label: "— No History", tier: "NONE", tone: "bg-slate-50 text-slate-400 border-slate-200" };
    }

    return {
      id: empId,
      name: data.name || "Unknown",
      email: data.email || undefined,
      avatarUrl: data.avatarUrl || null,
      roleTitle: role?.title || "Team Member",
      departmentName,
      managerName,
      monthScore,
      monthAutoScore,
      avg6Months,
      monthsCount6Mo: last6.length,
      increment,
    };
  });

  // Sort initially by name
  directoryEmployees.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DirectoryView
        employees={directoryEmployees}
        selectedMonthValue={selectedMonthValue}
        selectedMonthLabel={selectedMonthLabel}
        availableMonths={availableMonths}
      />
    </div>
  );
}
