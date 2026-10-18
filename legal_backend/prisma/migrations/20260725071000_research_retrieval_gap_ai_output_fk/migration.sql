ALTER TABLE "ResearchRetrievalGap"
ADD CONSTRAINT "ResearchRetrievalGap_aiOutputId_fkey"
FOREIGN KEY ("aiOutputId") REFERENCES "AIOutput"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
