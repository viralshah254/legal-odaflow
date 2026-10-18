-- Add checkpoint column for agentic workflow step durability (retry/resume).
ALTER TABLE "AgentWorkflowRun" ADD COLUMN IF NOT EXISTS "stepResults" JSONB;
