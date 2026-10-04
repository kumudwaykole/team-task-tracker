-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'MEMBER');

-- CreateEnum
CREATE TYPE "WorkItemType" AS ENUM ('TASK', 'TICKET');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('TODO', 'OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED', 'DONE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ASSIGNED', 'STATUS_CHANGED', 'COMMENTED', 'TICKET_CREATED', 'DUE_SOON');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "managerId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "addedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" UUID NOT NULL,
    "type" "WorkItemType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "Status" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "projectId" UUID,
    "requesterId" UUID NOT NULL,
    "assigneeId" UUID,
    "dueDate" TIMESTAMPTZ(3),
    "remindedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" UUID NOT NULL,
    "workItemId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "workItemId" UUID,
    "message" VARCHAR(500) NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_managerId_name_key" ON "Project"("managerId", "name");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE INDEX "WorkItem_projectId_status_idx" ON "WorkItem"("projectId", "status");

-- CreateIndex
CREATE INDEX "WorkItem_assigneeId_idx" ON "WorkItem"("assigneeId");

-- CreateIndex
CREATE INDEX "WorkItem_requesterId_idx" ON "WorkItem"("requesterId");

-- CreateIndex
CREATE INDEX "WorkItem_type_priority_idx" ON "WorkItem"("type", "priority");

-- CreateIndex
CREATE INDEX "WorkItem_dueDate_idx" ON "WorkItem"("dueDate");

-- CreateIndex
CREATE INDEX "WorkItem_createdAt_id_idx" ON "WorkItem"("createdAt", "id");

-- CreateIndex
CREATE INDEX "Comment_workItemId_createdAt_idx" ON "Comment"("workItemId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_userId_idx" ON "Comment"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_workItemId_idx" ON "Notification"("workItemId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Custom CHECK constraints (Prisma cannot declare these in schema.prisma)

-- A TASK must belong to a project
ALTER TABLE "WorkItem" ADD CONSTRAINT "task_requires_project"
  CHECK ("type" <> 'TASK' OR "projectId" IS NOT NULL);

-- Status must be valid for the item type
ALTER TABLE "WorkItem" ADD CONSTRAINT "status_matches_type"
  CHECK (
    ("type" = 'TASK'   AND "status" IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE')) OR
    ("type" = 'TICKET' AND "status" IN ('OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'))
  );
