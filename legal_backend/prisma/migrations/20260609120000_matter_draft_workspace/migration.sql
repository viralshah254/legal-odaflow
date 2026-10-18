-- Add drafting workspace JSON to matters (clause outline, missing fields, smart steps from intake preview)
ALTER TABLE "Matter" ADD COLUMN IF NOT EXISTS "draftWorkspace" JSONB;
