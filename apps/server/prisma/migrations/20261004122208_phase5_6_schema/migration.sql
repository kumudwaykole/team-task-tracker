-- AlterTable
ALTER TABLE "WorkItem" ADD COLUMN     "number" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "WorkItem_number_key" ON "WorkItem"("number");

