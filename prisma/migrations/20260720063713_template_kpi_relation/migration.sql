-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TaskTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kpiTemplateId" TEXT,
    "sizeLabel" TEXT,
    "category" TEXT,
    "checklistJSON" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskTemplate_kpiTemplateId_fkey" FOREIGN KEY ("kpiTemplateId") REFERENCES "KpiTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TaskTemplate" ("category", "checklistJSON", "createdAt", "createdById", "description", "id", "kpiTemplateId", "name", "sizeLabel", "title") SELECT "category", "checklistJSON", "createdAt", "createdById", "description", "id", "kpiTemplateId", "name", "sizeLabel", "title" FROM "TaskTemplate";
DROP TABLE "TaskTemplate";
ALTER TABLE "new_TaskTemplate" RENAME TO "TaskTemplate";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
