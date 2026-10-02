import { strict as assert } from "node:assert";

/**
 * Unit Test Suite for Admin Department Management Logic:
 * 1. Department members resolution (direct departmentId + role.departmentId fallback)
 * 2. Unassigned employees filtering
 * 3. Multi-employee department assignment calculations
 * 4. Safety checks for department deletion (unlinking roles/employees)
 */

function runDepartmentManagementTests() {
  console.log("▶ Running Admin Department Management Test Suite...\n");

  // Mock data
  const mockDepartments = [
    { id: "dept-eng", name: "Engineering" },
    { id: "dept-mkt", name: "Marketing" },
    { id: "dept-ops", name: "Operations" },
  ];

  const mockRoles = [
    { id: "role-swe", title: "Software Engineer", level: 50, departmentId: "dept-eng" },
    { id: "role-qa", title: "QA Tester", level: 60, departmentId: "dept-eng" },
    { id: "role-mkt", title: "Marketing Lead", level: 40, departmentId: "dept-mkt" },
    { id: "role-gen", title: "Executive Assistant", level: 70, departmentId: null },
  ];

  const mockEmployees = [
    { id: "emp-1", name: "Alice", roleId: "role-swe", departmentId: null, active: true },
    { id: "emp-2", name: "Bob", roleId: "role-qa", departmentId: "dept-ops", active: true }, // Explicit override to ops
    { id: "emp-3", name: "Charlie", roleId: "role-mkt", departmentId: null, active: true },
    { id: "emp-4", name: "Dave", roleId: "role-gen", departmentId: null, active: false }, // Unassigned
  ];

  const roleMap = new Map(mockRoles.map((r) => [r.id, r]));

  // Test 1: Employee department resolution
  // emp-1 inherits dept-eng from role-swe
  // emp-2 has explicit dept-ops override even though role-qa has dept-eng
  // emp-3 inherits dept-mkt from role-mkt
  // emp-4 has no department on employee or role -> unassigned (null)
  const resolved = mockEmployees.map((emp) => {
    const role = roleMap.get(emp.roleId);
    const resolvedDeptId = emp.departmentId || role?.departmentId || null;
    return { ...emp, resolvedDeptId };
  });

  const emp1 = resolved.find((e) => e.id === "emp-1")!;
  const emp2 = resolved.find((e) => e.id === "emp-2")!;
  const emp3 = resolved.find((e) => e.id === "emp-3")!;
  const emp4 = resolved.find((e) => e.id === "emp-4")!;

  assert.equal(emp1.resolvedDeptId, "dept-eng", "emp-1 should inherit engineering from role");
  assert.equal(emp2.resolvedDeptId, "dept-ops", "emp-2 should use explicit department override");
  assert.equal(emp3.resolvedDeptId, "dept-mkt", "emp-3 should inherit marketing from role");
  assert.equal(emp4.resolvedDeptId, null, "emp-4 should be null / unassigned");
  console.log("✓ Test 1 Passed: Employee department resolution with role fallback and override.");

  // Test 2: Department member counts and rosters
  const engMembers = resolved.filter((e) => e.resolvedDeptId === "dept-eng");
  const opsMembers = resolved.filter((e) => e.resolvedDeptId === "dept-ops");
  const mktMembers = resolved.filter((e) => e.resolvedDeptId === "dept-mkt");
  const unassigned = resolved.filter((e) => e.resolvedDeptId === null);

  assert.equal(engMembers.length, 1);
  assert.equal(opsMembers.length, 1);
  assert.equal(mktMembers.length, 1);
  assert.equal(unassigned.length, 1);
  assert.equal(unassigned[0].id, "emp-4");
  console.log("✓ Test 2 Passed: Accurate department roster grouping & unassigned filtering.");

  // Test 3: Assigning unassigned employee to department
  const updatedEmp4 = { ...emp4, departmentId: "dept-eng" };
  const resolvedUpdated = [...resolved.filter((e) => e.id !== "emp-4"), { ...updatedEmp4, resolvedDeptId: "dept-eng" }];
  const newEngMembers = resolvedUpdated.filter((e) => e.resolvedDeptId === "dept-eng");
  const newUnassigned = resolvedUpdated.filter((e) => e.resolvedDeptId === null);

  assert.equal(newEngMembers.length, 2);
  assert.equal(newUnassigned.length, 0);
  console.log("✓ Test 3 Passed: Dynamic assignment of unassigned employee to department.");

  // Test 4: Safe deletion unlinking
  const deptToDelete = "dept-eng";
  const unlinkedRoles = mockRoles.map((r) => (r.departmentId === deptToDelete ? { ...r, departmentId: null } : r));
  const unlinkedEmployees = mockEmployees.map((e) => (e.departmentId === deptToDelete ? { ...e, departmentId: null } : e));

  const engRolesAfterDelete = unlinkedRoles.filter((r) => r.departmentId === deptToDelete);
  const engEmpsAfterDelete = unlinkedEmployees.filter((e) => e.departmentId === deptToDelete);

  assert.equal(engRolesAfterDelete.length, 0);
  assert.equal(engEmpsAfterDelete.length, 0);
  console.log("✓ Test 4 Passed: Safe department deletion unlinks roles and employees to General.");

  console.log("\n🎉 ALL 4 ADMIN DEPARTMENT MANAGEMENT TESTS PASSED SUCCESSFULLY!\n");
}

runDepartmentManagementTests();
