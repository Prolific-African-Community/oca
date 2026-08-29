-- CreateEnum
CREATE TYPE "AIGenerationStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "AIGeneration" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseId" TEXT,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputSummary" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "status" "AIGenerationStatus" NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIGeneration_actorUserId_createdAt_idx" ON "AIGeneration"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AIGeneration_institutionId_createdAt_idx" ON "AIGeneration"("institutionId", "createdAt");

-- CreateIndex
CREATE INDEX "AIGeneration_courseId_createdAt_idx" ON "AIGeneration"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "AIGeneration_type_createdAt_idx" ON "AIGeneration"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "AIGeneration" ADD CONSTRAINT "AIGeneration_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIGeneration" ADD CONSTRAINT "AIGeneration_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIGeneration" ADD CONSTRAINT "AIGeneration_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
