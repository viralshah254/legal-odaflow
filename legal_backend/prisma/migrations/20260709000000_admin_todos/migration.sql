-- AlterTable: add adminProfile to User
ALTER TABLE "User" ADD COLUMN "adminProfile" TEXT;

-- CreateTable: AdminTodoTemplate
CREATE TABLE "AdminTodoTemplate" (
    "id" TEXT NOT NULL,
    "adminProfile" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminTodoTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminTodoTemplate_adminProfile_dayOfWeek_idx" ON "AdminTodoTemplate"("adminProfile", "dayOfWeek");

-- CreateTable: AdminTodoCompletion
CREATE TABLE "AdminTodoCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'ops',
    "dueDate" DATE NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminTodoCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminTodoCompletion_userId_templateId_dueDate_key" ON "AdminTodoCompletion"("userId", "templateId", "dueDate");

-- CreateIndex
CREATE INDEX "AdminTodoCompletion_userId_dueDate_idx" ON "AdminTodoCompletion"("userId", "dueDate");

-- AddForeignKey
ALTER TABLE "AdminTodoCompletion" ADD CONSTRAINT "AdminTodoCompletion_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTodoCompletion" ADD CONSTRAINT "AdminTodoCompletion_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "AdminTodoTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
