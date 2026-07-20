-- CreateTable
CREATE TABLE "AnnouncementReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "announcementId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '👍',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnnouncementReaction_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnnouncementReaction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnnouncementComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "announcementId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnnouncementComment_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnnouncementComment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BirthdayWish" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "forId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "taggedIds" TEXT,
    "year" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BirthdayWish_forId_fkey" FOREIGN KEY ("forId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BirthdayWish_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BehaviourReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "ratedById" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "attendance" REAL NOT NULL DEFAULT 0,
    "punctuality" REAL NOT NULL DEFAULT 0,
    "learning" REAL NOT NULL DEFAULT 0,
    "helpfulness" REAL NOT NULL DEFAULT 0,
    "trust" REAL NOT NULL DEFAULT 0,
    "conduct" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BehaviourReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BehaviourReview_ratedById_fkey" FOREIGN KEY ("ratedById") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementReaction_announcementId_employeeId_emoji_key" ON "AnnouncementReaction"("announcementId", "employeeId", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "BehaviourReview_employeeId_year_month_key" ON "BehaviourReview"("employeeId", "year", "month");
