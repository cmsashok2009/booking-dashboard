DROP TABLE IF EXISTS runtime_revision;
DROP TABLE IF EXISTS runtime_metadata;
DROP TABLE IF EXISTS email_oauth_states;

UPDATE email_provider_connections
SET status = 'inactive'
WHERE status IN ('replaced', 'disconnected');
UPDATE users
SET status = 'pending_invitation'
WHERE status = 'invited';

ALTER TABLE email_provider_connections
  DROP COLUMN entity_json,
  MODIFY COLUMN status ENUM('active', 'inactive') NOT NULL DEFAULT 'active';
ALTER TABLE notifications
  DROP COLUMN entity_json,
  MODIFY COLUMN user_id VARCHAR(64) NOT NULL;
ALTER TABLE audit_logs DROP COLUMN entity_json;
ALTER TABLE file_uploads DROP COLUMN entity_json;
ALTER TABLE email_delivery_events DROP COLUMN entity_json;
ALTER TABLE activation_tokens DROP COLUMN entity_json;
ALTER TABLE email_recipients DROP COLUMN entity_json;
ALTER TABLE email_campaigns DROP COLUMN entity_json;
ALTER TABLE email_template_versions DROP COLUMN entity_json;
ALTER TABLE email_templates DROP COLUMN entity_json;
ALTER TABLE email_template_samples DROP COLUMN entity_json;
ALTER TABLE onboarding_workflows DROP COLUMN entity_json;
ALTER TABLE password_reset_tokens DROP COLUMN entity_json;
ALTER TABLE sessions DROP COLUMN entity_json;
ALTER TABLE bookings DROP COLUMN entity_json;
ALTER TABLE lookup_options DROP COLUMN entity_json;
ALTER TABLE dealer_assignments DROP COLUMN entity_json;
ALTER TABLE dealer_codes DROP COLUMN entity_json;
ALTER TABLE users
  DROP COLUMN entity_json,
  MODIFY COLUMN status ENUM('pending_invitation', 'active', 'inactive', 'locked') NOT NULL;
ALTER TABLE regions DROP COLUMN entity_json;
ALTER TABLE roles DROP COLUMN entity_json;