import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser, canScoreCompanyWide, hasPermission } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { loadEmployeePerformance } from "@/lib/employeePerformance";
import SimplifiedPerformanceView from "../../_components/SimplifiedPerformanceView";

export default async function EmployeePerformancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (!hasPermission(user, "people")) redirect("/");

  const empDoc = await adminDb.collection("Employee").doc(id).get();
  if (!empDoc.exists) notFound();
  
  const rawEmpData = empDoc.data()!;
  let roleData: any = { title: "Unknown", department: null };
  const reportsToIds = rawEmpData.reportsToIds || (rawEmpData.reportsToId ? [rawEmpData.reportsToId] : []);
  let reportsToName: string | null = null;

  const [roleDoc, reportsToDocs] = await Promise.all([
    rawEmpData.roleId ? adminDb.collection("Role").doc(rawEmpData.roleId).get() : Promise.resolve(null),
    reportsToIds.length > 0
      ? Promise.all(reportsToIds.map((id: string) => adminDb.collection("Employee").doc(id).get()))
      : Promise.resolve([]),
  ]);

  if (roleDoc?.exists) {
    const role = roleDoc.data()!;
    roleData.title = role.title;
    if (role.departmentId) {
      const deptDoc = await adminDb.collection("Department").doc(role.departmentId).get();
      if (deptDoc.exists) roleData.department = { name: deptDoc.data()!.name };
    }
  }
  const reportsToNames = reportsToDocs.map((doc: any) => doc?.exists ? doc.data().name : "").filter(Boolean);
  if (reportsToNames.length > 0) reportsToName = reportsToNames.join(", ");

  const employee: any = { id: empDoc.id, ...rawEmpData, role: roleData, reportsToId: rawEmpData.reportsToId, reportsToIds, reportsTo: reportsToName ? { name: reportsToName } : null };

  // Admin/CEO/HR see anyone; a plain manager only sees their own direct reports.
  const allowed = canScoreCompanyWide(user) || reportsToIds.includes(user.id) || employee.id === user.id;
  if (!allowed) redirect("/people");

  const performanceData = await loadEmployeePerformance(id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/people" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Directory
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
          {employee.name.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{employee.name}</h1>
          <p className="text-sm text-slate-500">
            {employee.role.title}
            {employee.role.department && <> · {employee.role.department.name}</>}
            {employee.reportsTo && <> · reports to {employee.reportsTo.name}</>}
          </p>
        </div>
      </div>

      <SimplifiedPerformanceView
        employeeName={employee.name}
        roleTitle={employee.role.title}
        departmentName={employee.role.department?.name}
        reportsToName={employee.reportsTo?.name}
        performanceData={performanceData}
        isManagerOrAdmin={true}
      />
    </div>
  );
}
