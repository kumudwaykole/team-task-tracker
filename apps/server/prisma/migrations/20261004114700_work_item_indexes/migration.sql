-- DropIndex
DROP INDEX "WorkItem_assigneeId_idx";

-- CreateIndex
CREATE INDEX "WorkItem_assigneeId_status_idx" ON "WorkItem"("assigneeId", "status");
