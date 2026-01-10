-- Add new fields to analysis_uploads table
ALTER TABLE analysis_uploads 
ADD COLUMN deficiencies TEXT,
ADD COLUMN key_findings TEXT,
ADD COLUMN follow_up_tests TEXT;

-- Update comments for clarity
COMMENT ON COLUMN analysis_uploads.deficiencies IS 'Detected nutrient or hormonal deficiencies';
COMMENT ON COLUMN analysis_uploads.key_findings IS 'Main findings from the blood analysis';
COMMENT ON COLUMN analysis_uploads.follow_up_tests IS 'Recommended follow-up tests or medical consultations';
