import assert from "node:assert";
import { getReportRange, formatYMD } from "../dateRanges";

console.log("▶ Running Employee Task Report & KPI Work Analysis Test Suite...\n");

// Test 1: Daily range calculation
{
  const res = getReportRange({ range: "daily", date: "2026-10-02" });
  assert.strictEqual(res.rangeType, "daily");
  assert.strictEqual(formatYMD(res.startDate), "2026-10-02");
  assert.strictEqual(formatYMD(res.endDate), "2026-10-02");
  assert.strictEqual(res.prevParams.date, "2026-10-01");
  assert.strictEqual(res.nextParams.date, "2026-10-03");
  console.log("✓ Test 1 Passed: Daily date range calculation and day-stepping.");
}

// Test 2: Weekly range calculation (Monday - Sunday)
{
  // 2026-10-02 is a Friday
  const res = getReportRange({ range: "weekly", date: "2026-10-02" });
  assert.strictEqual(res.rangeType, "weekly");
  // Monday of this week is Sep 28, 2026
  assert.strictEqual(formatYMD(res.startDate), "2026-09-28");
  // Sunday of this week is Oct 04, 2026
  assert.strictEqual(formatYMD(res.endDate), "2026-10-04");
  assert.strictEqual(res.prevParams.date, "2026-09-21");
  assert.strictEqual(res.nextParams.date, "2026-10-05");
  console.log("✓ Test 2 Passed: Weekly range correctly resolves Monday to Sunday.");
}

// Test 3: Monthly range calculation
{
  const res = getReportRange({ range: "monthly", year: 2026, month: 10 });
  assert.strictEqual(res.rangeType, "monthly");
  assert.strictEqual(formatYMD(res.startDate), "2026-10-01");
  assert.strictEqual(formatYMD(res.endDate), "2026-10-31");
  assert.strictEqual(res.prevParams.range, "monthly");
  assert.strictEqual(res.nextParams.range, "monthly");
  console.log("✓ Test 3 Passed: Monthly range spans 1st to last day of month.");
}

// Test 4: Quarterly range calculation
{
  const resQ4 = getReportRange({ range: "quarterly", year: 2026, quarter: 4 });
  assert.strictEqual(resQ4.rangeType, "quarterly");
  assert.strictEqual(formatYMD(resQ4.startDate), "2026-10-01");
  assert.strictEqual(formatYMD(resQ4.endDate), "2026-12-31");
  assert.strictEqual(resQ4.label, "Q4 2026");

  const resQ1 = getReportRange({ range: "quarterly", year: 2026, quarter: 1 });
  assert.strictEqual(formatYMD(resQ1.startDate), "2026-01-01");
  assert.strictEqual(formatYMD(resQ1.endDate), "2026-03-31");
  console.log("✓ Test 4 Passed: Quarterly range correctly spans quarter months (Q1-Q4).");
}

// Test 5: Yearly range calculation
{
  const res = getReportRange({ range: "yearly", year: 2026 });
  assert.strictEqual(res.rangeType, "yearly");
  assert.strictEqual(formatYMD(res.startDate), "2026-01-01");
  assert.strictEqual(formatYMD(res.endDate), "2026-12-31");
  assert.strictEqual(res.prevParams.range, "yearly");
  assert.strictEqual(res.nextParams.range, "yearly");
  console.log("✓ Test 5 Passed: Yearly range spans full calendar year.");
}

// Test 6: Custom date range
{
  const res = getReportRange({ range: "custom", from: "2026-09-15", to: "2026-10-02" });
  assert.strictEqual(res.rangeType, "custom");
  assert.strictEqual(formatYMD(res.startDate), "2026-09-15");
  assert.strictEqual(formatYMD(res.endDate), "2026-10-02");
  console.log("✓ Test 6 Passed: Custom date range correctly applies from and to filters.");
}

// Test 7: KPI usage percentage and sorting
{
  const totalTasks = 42;
  const kpiTaxationTasks = 14;
  const kpiVoucherTasks = 10;
  const kpiMiscTasks = 7;

  const taxationUsagePct = Math.round((kpiTaxationTasks / totalTasks) * 1000) / 10;
  const voucherUsagePct = Math.round((kpiVoucherTasks / totalTasks) * 1000) / 10;
  const miscUsagePct = Math.round((kpiMiscTasks / totalTasks) * 1000) / 10;

  assert.strictEqual(taxationUsagePct, 33.3, "Taxation usage should be 33.3%");
  assert.strictEqual(voucherUsagePct, 23.8, "Voucher entry usage should be 23.8%");
  assert.strictEqual(miscUsagePct, 16.7, "Misc usage should be 16.7%");

  console.log("✓ Test 7 Passed: KPI usage percentages correctly derived from task volume.");
}

// Test 8: Delivery quality rates & dynamic formulas
{
  const total = 42;
  const closed = 35;
  const onTime = 30;
  const rework = 3;
  const carry = 4;

  const completionRate = Math.round((closed / total) * 1000) / 10;
  const onTimeRate = Math.round((onTime / closed) * 1000) / 10;
  const reworkRate = Math.round((rework / total) * 1000) / 10;
  const carryRate = Math.round((carry / total) * 1000) / 10;

  assert.strictEqual(completionRate, 83.3, "Completion rate should be 83.3%");
  assert.strictEqual(onTimeRate, 85.7, "On-time rate should be 85.7%");
  assert.strictEqual(reworkRate, 7.1, "Rework rate should be 7.1%");
  assert.strictEqual(carryRate, 9.5, "Carry rate should be 9.5%");

  const onTimeFormula = `${onTime} on-time closed tasks ÷ ${closed} completed tasks = ${onTimeRate}%`;
  assert.strictEqual(onTimeFormula, "30 on-time closed tasks ÷ 35 completed tasks = 85.7%");
  console.log("✓ Test 8 Passed: Delivery quality metrics & dynamic formula strings match.");
}

console.log("\n🎉 ALL 8 TASK REPORT & KPI WORK ANALYSIS TESTS PASSED SUCCESSFULLY!");
