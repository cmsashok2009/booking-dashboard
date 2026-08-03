ALTER TABLE roles ADD COLUMN entity_json JSON NULL;
ALTER TABLE regions ADD COLUMN entity_json JSON NULL;
ALTER TABLE users
  MODIFY COLUMN status ENUM('pending_invitation', 'invited', 'active', 'inactive', 'locked') NOT NULL,
  ADD COLUMN entity_json JSON NULL;
ALTER TABLE dealer_codes ADD COLUMN entity_json JSON NULL;
ALTER TABLE dealer_assignments ADD COLUMN entity_json JSON NULL;
ALTER TABLE lookup_options ADD COLUMN entity_json JSON NULL;
ALTER TABLE bookings ADD COLUMN entity_json JSON NULL;
ALTER TABLE sessions ADD COLUMN entity_json JSON NULL;
ALTER TABLE password_reset_tokens ADD COLUMN entity_json JSON NULL;
ALTER TABLE onboarding_workflows ADD COLUMN entity_json JSON NULL;
ALTER TABLE email_template_samples ADD COLUMN entity_json JSON NULL;
ALTER TABLE email_templates ADD COLUMN entity_json JSON NULL;
ALTER TABLE email_template_versions ADD COLUMN entity_json JSON NULL;
ALTER TABLE email_campaigns ADD COLUMN entity_json JSON NULL;
ALTER TABLE email_recipients ADD COLUMN entity_json JSON NULL;
ALTER TABLE activation_tokens ADD COLUMN entity_json JSON NULL;
ALTER TABLE email_delivery_events ADD COLUMN entity_json JSON NULL;
ALTER TABLE file_uploads ADD COLUMN entity_json JSON NULL;
ALTER TABLE audit_logs ADD COLUMN entity_json JSON NULL;
ALTER TABLE notifications
  MODIFY COLUMN user_id VARCHAR(64) NULL,
  ADD COLUMN entity_json JSON NULL;
ALTER TABLE email_provider_connections
  MODIFY COLUMN status ENUM('active', 'inactive', 'replaced', 'disconnected') NOT NULL DEFAULT 'active',
  ADD COLUMN entity_json JSON NULL;

CREATE TABLE IF NOT EXISTS email_oauth_states (
  id VARCHAR(80) PRIMARY KEY,
  state_digest CHAR(64) NOT NULL,
  admin_user_id VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP(6) NOT NULL,
  used_at TIMESTAMP(6) NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  entity_json JSON NOT NULL,
  UNIQUE KEY uq_email_oauth_state_digest (state_digest),
  KEY ix_email_oauth_state_expiry (used_at, expires_at),
  CONSTRAINT fk_email_oauth_admin FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS runtime_metadata (
  metadata_key VARCHAR(100) PRIMARY KEY,
  value_json JSON NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS runtime_revision (
  state_key VARCHAR(100) PRIMARY KEY,
  version BIGINT UNSIGNED NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;