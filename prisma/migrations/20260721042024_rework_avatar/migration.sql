-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "avatarUrl" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "sizeLabel" TEXT,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "important" BOOLEAN NOT NULL DEFAULT false,
    "estimatedMins" INTEGER,
    "actualMins" INTEGER,
    "creatorId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "kpiTemplateId" TEXT,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "reviewerId" TEXT,
    "holdReason" TEXT,
    "projectId" TEXT,
    "groupId" TEXT,
    "category" TEXT,
    "dueAt" DATETIME,
    "startAt" DATETIME,
    "endAt" DATETIME,
    "carryForwardDate" DATETIME,
    "carryCount" INTEGER NOT NULL DEFAULT 0,
    "reworkCount" INTEGER NOT NULL DEFAULT 0,
    "rejectionReason" TEXT,
    "rejectedAt" DATETIME,
    "completedAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_kpiTemplateId_fkey" FOREIGN KEY ("kpiTemplateId") REFERENCES "KpiTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("actualMins", "assigneeId", "carryCount", "carryForwardDate", "category", "completedAt", "createdAt", "creatorId", "deletedAt", "description", "dueAt", "endAt", "estimatedMins", "groupId", "holdReason", "id", "important", "kpiTemplateId", "projectId", "reviewRequired", "reviewerId", "sizeLabel", "startAt", "status", "title", "updatedAt", "urgent") SELECT "actualMins", "assigneeId", "carryCount", "carryForwardDate", "category", "completedAt", "createdAt", "creatorId", "deletedAt", "description", "dueAt", "endAt", "estimatedMins", "groupId", "holdReason", "id", "important", "kpiTemplateId", "projectId", "reviewRequired", "reviewerId", "sizeLabel", "startAt", "status", "title", "updatedAt", "urgent" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
