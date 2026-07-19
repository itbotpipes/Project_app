-- AlterTable
ALTER TABLE "Project" ADD COLUMN "deadline" DATETIME;

-- CreateTable
CREATE TABLE "ProjectExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'MATERIAL',
    "amount" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectExpense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
