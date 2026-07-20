-- CreateTable
CREATE TABLE "YearlyReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "behaviourScore" REAL,
    "targetAchievedPct" REAL,
    "note" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "YearlyReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MonthlyScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "kpiTemplateId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "autoScore" REAL NOT NULL DEFAULT 0,
    "score" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    CONSTRAINT "MonthlyScore_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MonthlyScore_kpiTemplateId_fkey" FOREIGN KEY ("kpiTemplateId") REFERENCES "KpiTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MonthlyScore" ("employeeId", "id", "kpiTemplateId", "month", "note", "score", "year") SELECT "employeeId", "id", "kpiTemplateId", "month", "note", "score", "year" FROM "MonthlyScore";
DROP TABLE "MonthlyScore";
ALTER TABLE "new_MonthlyScore" RENAME TO "MonthlyScore";
CREATE UNIQUE INDEX "MonthlyScore_employeeId_kpiTemplateId_year_month_key" ON "MonthlyScore"("employeeId", "kpiTemplateId", "year", "month");
CREATE TABLE "new_MonthlyScorecard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "total" REAL NOT NULL DEFAULT 0,
    "autoTotal" REAL NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'imported',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyScorecard_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MonthlyScorecard" ("employeeId", "id", "locked", "month", "source", "total", "updatedAt", "year") SELECT "employeeId", "id", "locked", "month", "source", "total", "updatedAt", "year" FROM "MonthlyScorecard";
DROP TABLE "MonthlyScorecard";
ALTER TABLE "new_MonthlyScorecard" RENAME TO "MonthlyScorecard";
CREATE UNIQUE INDEX "MonthlyScorecard_employeeId_year_month_key" ON "MonthlyScorecard"("employeeId", "year", "month");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "YearlyReview_employeeId_year_key" ON "YearlyReview"("employeeId", "year");
