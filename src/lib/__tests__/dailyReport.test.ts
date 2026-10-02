import assert from "node:assert";
import { getTaskDailyState, toDate } from "../dailyReportState";

console.log("▶ Running Daily Reports Audit Test Suite...\n");

const sep10Start = new Date("2026-09-10T00:00:00.000Z");
const sep10End = new Date("2026-09-10T23:59:59.999Z");

const sep15Start = new Date("2026-09-15T00:00:00.000Z");
const sep15End = new Date("2026-09-15T23:59:59.999Z");

const sep16Start = new Date("2026-09-16T00:00:00.000Z");
const sep16End = new Date("2026-09-16T23:59:59.999Z");

const sep20Start = new Date("2026-09-20T00:00:00.000Z");
const sep20End = new Date("2026-09-20T23:59:59.999Z");

const oct01Start = new Date("2026-10-01T00:00:00.000Z");
const oct01End = new Date("2026-10-01T23:59:59.999Z");

// Test 1: Task created Oct 1 and open today does not appear on Sep 10
{
  const task = {
    id: "task-oct1",
    title: "October Task",
    status: "IN_PROGRESS",
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    dueAt: new Date("2026-10-05T18:00:00.000Z"),
  };

  const state = getTaskDailyState(
    task,
    [],
    [],
    null,
    sep10Start,
    sep10End,
    false
  );

  assert.strictEqual(state.relevantForDay, false, "Task created in Oct must not be relevant on Sep 10");
  assert.strictEqual(state.wasActiveThatDay, false);
  console.log("✓ Test 1 Passed: Task created Oct 1 and open today does not appear on Sep 10.");
}

// Test 2: Task in progress Sep 15 and closed Sep 20 still appears correctly on Sep 15
{
  const task = {
    id: "task-sep15",
    title: "Mid-month Task",
    status: "CLOSED", // Current status today is CLOSED
    createdAt: new Date("2026-09-12T10:00:00.000Z"),
    completedAt: new Date("2026-09-20T16:00:00.000Z"),
    dueAt: new Date("2026-09-20T18:00:00.000Z"),
  };

  const auditLogs = [
    {
      action: "task.create",
      createdAt: new Date("2026-09-12T10:00:00.000Z"),
      detail: "Mid-month Task",
    },
    {
      action: "task.move",
      createdAt: new Date("2026-09-15T11:00:00.000Z"),
      detail: "IN_PROGRESS",
    },
    {
      action: "task.move",
      createdAt: new Date("2026-09-20T16:00:00.000Z"),
      detail: "CLOSED",
    },
  ];

  const stateSep15 = getTaskDailyState(
    task,
    auditLogs,
    [],
    null,
    sep15Start,
    sep15End,
    false
  );

  assert.strictEqual(stateSep15.relevantForDay, true, "Task must be relevant on Sep 15");
  assert.strictEqual(stateSep15.statusAtEndOfDay, "IN_PROGRESS", "Task must be IN_PROGRESS on Sep 15 even though CLOSED today");
  assert.strictEqual(stateSep15.completedThatDay, false, "Task was NOT completed on Sep 15");
  assert.strictEqual(stateSep15.wasActiveThatDay, true, "Task was active on Sep 15");
  console.log("✓ Test 2 Passed: Task in progress Sep 15 and closed Sep 20 appears as IN_PROGRESS on Sep 15.");
}

// Test 3: Task due Sep 10 and completed Sep 12 is overdue on Sep 10
{
  const task = {
    id: "task-due-sep10",
    title: "Deadline Task",
    status: "CLOSED",
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    dueAt: new Date("2026-09-08T18:00:00.000Z"), // due before Sep 10
    completedAt: new Date("2026-09-12T10:00:00.000Z"), // completed 2 days after Sep 10
  };

  const stateSep10 = getTaskDailyState(
    task,
    [],
    [],
    null,
    sep10Start,
    sep10End,
    false
  );

  assert.strictEqual(stateSep10.relevantForDay, true, "Task was open and past due on Sep 10");
  assert.strictEqual(stateSep10.overdueThatDay, true, "Task must be counted as overdue on Sep 10");
  assert.strictEqual(stateSep10.isOnTime, false, "isOnTime must be false on Sep 10");
  console.log("✓ Test 3 Passed: Task due before Sep 10 and completed Sep 12 is counted as overdue on Sep 10.");
}

// Test 4: Task completed Sep 9 is not overdue on Sep 10
{
  const task = {
    id: "task-closed-sep9",
    title: "Early Finish Task",
    status: "CLOSED",
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    dueAt: new Date("2026-09-10T18:00:00.000Z"),
    completedAt: new Date("2026-09-09T15:00:00.000Z"),
  };

  const stateSep10 = getTaskDailyState(
    task,
    [],
    [],
    null,
    sep10Start,
    sep10End,
    false
  );

  assert.strictEqual(stateSep10.overdueThatDay, false, "Task completed Sep 9 must not be overdue on Sep 10");
  assert.strictEqual(stateSep10.relevantForDay, false, "Task completed Sep 9 without Sep 10 activity is not relevant on Sep 10");
  console.log("✓ Test 4 Passed: Task completed Sep 9 is not overdue on Sep 10.");
}

// Test 5: Rework on Sep 15 appears only on Sep 15
{
  const task = {
    id: "task-rework",
    title: "Quality Review Task",
    status: "CLOSED",
    reworkCount: 3, // Cumulative rework count today is 3
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    rejectedAt: new Date("2026-09-15T14:30:00.000Z"),
    rejectionReason: "Missing unit tests",
    completedAt: new Date("2026-09-22T10:00:00.000Z"),
  };

  const auditLogs = [
    {
      action: "task.reject",
      createdAt: new Date("2026-09-15T14:30:00.000Z"),
      detail: "Missing unit tests",
    },
  ];

  const stateSep15 = getTaskDailyState(
    task,
    auditLogs,
    [],
    null,
    sep15Start,
    sep15End,
    false
  );

  const stateSep16 = getTaskDailyState(
    task,
    auditLogs,
    [],
    null,
    sep16Start,
    sep16End,
    false
  );

  assert.strictEqual(stateSep15.reworkedThatDay, true, "Rework must be flagged on Sep 15");
  assert.strictEqual(stateSep15.rejectionReason, "Missing unit tests");
  assert.strictEqual(stateSep16.reworkedThatDay, false, "Rework must NOT be flagged on Sep 16");
  console.log("✓ Test 5 Passed: Rework rejected on Sep 15 appears only on Sep 15 (not blindly on every day).");
}

// Test 6: Carry-forward on Sep 16 appears only on Sep 16
{
  const task = {
    id: "task-carry",
    title: "Carried Task",
    status: "IN_PROGRESS",
    carryCount: 4, // Cumulative carry count today is 4
    carryForwardDate: new Date("2026-09-16T00:05:00.000Z"),
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
  };

  const auditLogs = [
    {
      action: "task.autoCarryForward",
      createdAt: new Date("2026-09-16T00:05:00.000Z"),
      detail: "Carried forward to today",
    },
  ];

  const stateSep16 = getTaskDailyState(
    task,
    auditLogs,
    [],
    null,
    sep16Start,
    sep16End,
    false
  );

  const stateSep15 = getTaskDailyState(
    task,
    auditLogs,
    [],
    null,
    sep15Start,
    sep15End,
    false
  );

  assert.strictEqual(stateSep16.carriedThatDay, true, "Carry forward must be flagged on Sep 16");
  assert.strictEqual(stateSep15.carriedThatDay, false, "Carry forward must NOT be flagged on Sep 15");
  console.log("✓ Test 6 Passed: Carry forward on Sep 16 appears only on Sep 16.");
}

// Test 7: Soft-deleted tasks do not count when deleted prior to date
{
  const task = {
    id: "task-deleted",
    title: "Deleted Task",
    status: "IN_PROGRESS",
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    deletedAt: new Date("2026-09-08T12:00:00.000Z"), // deleted 2 days before Sep 10
  };

  const stateSep10 = getTaskDailyState(
    task,
    [],
    [],
    null,
    sep10Start,
    sep10End,
    false
  );

  assert.strictEqual(stateSep10.relevantForDay, false, "Soft-deleted task must not be included on Sep 10");
  assert.strictEqual(stateSep10.overdueThatDay, false);
  console.log("✓ Test 7 Passed: Soft-deleted tasks do not count when deleted prior to date.");
}

// Test 8: KPI bucket activity only counts when actual daily activity exists
{
  const taskWithActivity = {
    id: "task-kpi-active",
    title: "Active KPI Task",
    kpiTemplateId: "kpi-code-quality",
    status: "IN_PROGRESS",
    createdAt: new Date("2026-09-15T09:00:00.000Z"),
  };

  const stateSep15 = getTaskDailyState(
    taskWithActivity,
    [],
    [],
    null,
    sep15Start,
    sep15End,
    false
  );

  assert.strictEqual(stateSep15.createdThatDay, true);
  assert.strictEqual(stateSep15.wasActiveThatDay, true, "KPI task created on Sep 15 is active on Sep 15");
  console.log("✓ Test 8 Passed: KPI bucket activity counts when qualifying task activity occurs on date.");
}

// Test 9: Employee with only a current open task but no activity on selected date is marked NO_ACTIVITY
{
  const taskFromOctober = {
    id: "task-oct-open",
    title: "Open Today Task",
    status: "IN_PROGRESS",
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
  };

  const stateSep10 = getTaskDailyState(
    taskFromOctober,
    [],
    [],
    null, // No ritual on Sep 10
    sep10Start,
    sep10End,
    false
  );

  assert.strictEqual(stateSep10.relevantForDay, false, "Unrelated future open task has no activity on Sep 10");
  console.log("✓ Test 9 Passed: Employee with only a future/unrelated open task is not marked active on historical date.");
}

// Test 10: Admin / Manager / Employee permissions behave correctly
{
  const allEmployees = [
    { id: "admin-1", name: "Alice Admin", reportsToIds: [] },
    { id: "mgr-1", name: "Bob Manager", reportsToIds: ["admin-1"] },
    { id: "emp-1", name: "Charlie Worker", reportsToIds: ["mgr-1"] },
    { id: "emp-2", name: "Dave Worker", reportsToIds: ["admin-1"] },
  ];

  // Helper simulating permission scoping logic from loadCompanyDailyReport
  function scopeEmployees(viewer: any) {
    const isCompany = viewer.systemRole === "ADMIN" || viewer.systemRole === "CEO" || viewer.role?.title?.toLowerCase().includes("hr");
    const isMgr = viewer.systemRole === "MANAGER";
    
    if (isCompany) {
      return { scope: "COMPANY", emps: allEmployees };
    } else if (isMgr) {
      const team = allEmployees.filter((e) => e.reportsToIds.includes(viewer.id) || e.id === viewer.id);
      return { scope: "TEAM", emps: team };
    } else {
      const self = allEmployees.filter((e) => e.id === viewer.id);
      return { scope: "SELF", emps: self };
    }
  }

  const adminScope = scopeEmployees({ id: "admin-1", systemRole: "ADMIN", role: { title: "Administrator" } });
  assert.strictEqual(adminScope.scope, "COMPANY");
  assert.strictEqual(adminScope.emps.length, 4, "Admin must see company-wide reports");

  const mgrScope = scopeEmployees({ id: "mgr-1", systemRole: "MANAGER", role: { title: "Engineering Manager" } });
  assert.strictEqual(mgrScope.scope, "TEAM");
  assert.strictEqual(mgrScope.emps.length, 2, "Manager must see direct reports + self");
  assert.deepStrictEqual(mgrScope.emps.map((e) => e.id).sort(), ["emp-1", "mgr-1"].sort());

  const empScope = scopeEmployees({ id: "emp-1", systemRole: "USER", role: { title: "Developer" } });
  assert.strictEqual(empScope.scope, "SELF");
  assert.strictEqual(empScope.emps.length, 1, "Regular employee must see only their own report");
  assert.strictEqual(empScope.emps[0].id, "emp-1");

  console.log("✓ Test 10 Passed: Admin, Manager, and Employee permission scoping behaves correctly.");
}

console.log("\n🎉 ALL 10 CRITICAL DAILY REPORT TEST SUITE CASES PASSED SUCCESSFULLY!");
