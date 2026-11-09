-- Review decisions are append-only. Tenant/item deletion may still cascade
-- according to retention policy; modifying an existing decision is prohibited.
CREATE FUNCTION "prevent_firm_knowledge_review_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Firm knowledge review records cannot be updated' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER "FirmKnowledgeReview_immutable_update"
BEFORE UPDATE ON "FirmKnowledgeReview"
FOR EACH ROW EXECUTE FUNCTION "prevent_firm_knowledge_review_update"();
