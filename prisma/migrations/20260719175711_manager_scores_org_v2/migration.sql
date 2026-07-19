-- AlterTable
ALTER TABLE "DailyRitual" ADD COLUMN "plannedTaskIds" TEXT;

-- CreateTable
CREATE TABLE "ManagerScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "ratedById" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'MONTHLY',
    "periodStart" DATETIME NOT NULL,
    "score" REAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManagerScore_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ManagerScore_ratedById_fkey" FOREIGN KEY ("ratedById") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagerScore_employeeId_period_periodStart_key" ON "ManagerScore"("employeeId", "period", "periodStart");
