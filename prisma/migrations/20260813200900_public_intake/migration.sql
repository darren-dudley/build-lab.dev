-- DropForeignKey
ALTER TABLE "Initiative" DROP CONSTRAINT "Initiative_requesterId_fkey";

-- DropForeignKey
ALTER TABLE "StatusTransition" DROP CONSTRAINT "StatusTransition_actorId_fkey";

-- AlterTable
ALTER TABLE "Initiative" ADD COLUMN     "requesterEmail" TEXT,
ADD COLUMN     "requesterName" TEXT,
ALTER COLUMN "requesterId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StatusTransition" ALTER COLUMN "actorId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusTransition" ADD CONSTRAINT "StatusTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
