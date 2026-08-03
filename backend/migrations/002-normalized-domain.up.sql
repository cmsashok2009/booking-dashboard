CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  checksum CHAR(64) NOT NULL,
  applied_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  hierarchy_level SMALLINT UNSIGNED NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  permissions_json JSON NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_roles_name (name),
  KEY ix_roles_status_level (status, hierarchy_level)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS regions (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  normalized_name VARCHAR(60) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_regions_normalized_name (normalized_name),
  KEY ix_regions_status_name (status, name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(254) NOT NULL,
  normalized_email VARCHAR(254) NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  role_id VARCHAR(64) NOT NULL,
  region_id VARCHAR(64) NULL,
  reporting_manager_id VARCHAR(64) NULL,
  status ENUM('pending_invitation', 'active', 'inactive', 'locked') NOT NULL,
  password_hash VARCHAR(255) NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  failed_login_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until TIMESTAMP(6) NULL,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_users_normalized_email (normalized_email),
  KEY ix_users_role_status (role_id, status),
  KEY ix_users_region_status (region_id, status),
  KEY ix_users_manager (reporting_manager_id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_users_region FOREIGN KEY (region_id) REFERENCES regions(id),
  CONSTRAINT fk_users_reporting_manager FOREIGN KEY (reporting_manager_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dealer_codes (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(30) NOT NULL,
  normalized_code VARCHAR(30) NOT NULL,
  region_id VARCHAR(64) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_dealer_codes_normalized_code (normalized_code),
  KEY ix_dealer_codes_region_status (region_id, status),
  CONSTRAINT fk_dealer_codes_region FOREIGN KEY (region_id) REFERENCES regions(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dealer_assignments (
  id VARCHAR(64) PRIMARY KEY,
  dealer_code_id VARCHAR(64) NOT NULL,
  area_manager_id VARCHAR(64) NOT NULL,
  regional_manager_id VARCHAR(64) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_dealer_assignments_active (dealer_code_id, is_active),
  KEY ix_dealer_assignments_area_manager (area_manager_id, is_active),
  KEY ix_dealer_assignments_regional_manager (regional_manager_id, is_active),
  CONSTRAINT fk_dealer_assignments_code FOREIGN KEY (dealer_code_id) REFERENCES dealer_codes(id),
  CONSTRAINT fk_dealer_assignments_area FOREIGN KEY (area_manager_id) REFERENCES users(id),
  CONSTRAINT fk_dealer_assignments_regional FOREIGN KEY (regional_manager_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lookup_options (
  id VARCHAR(64) PRIMARY KEY,
  field_key VARCHAR(80) NOT NULL,
  value VARCHAR(255) NOT NULL,
  normalized_value VARCHAR(255) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_lookup_field_value (field_key, normalized_value),
  KEY ix_lookup_field_status_sort (field_key, status, sort_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(80) PRIMARY KEY,
  sales_order_id VARCHAR(100) NOT NULL,
  dealer_code_id VARCHAR(64) NOT NULL,
  region_id VARCHAR(64) NOT NULL,
  assigned_area_manager_id VARCHAR(64) NULL,
  assigned_regional_manager_id VARCHAR(64) NULL,
  customer_name VARCHAR(200) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL DEFAULT '',
  model VARCHAR(120) NOT NULL DEFAULT '',
  variant VARCHAR(120) NOT NULL DEFAULT '',
  source_json JSON NOT NULL,
  area_inputs_json JSON NOT NULL,
  regional_inputs_json JSON NOT NULL,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  imported_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_bookings_sales_order (sales_order_id),
  KEY ix_bookings_dealer (dealer_code_id),
  KEY ix_bookings_region_updated (region_id, updated_at),
  KEY ix_bookings_area_manager (assigned_area_manager_id, updated_at),
  KEY ix_bookings_regional_manager (assigned_regional_manager_id, updated_at),
  CONSTRAINT fk_bookings_dealer FOREIGN KEY (dealer_code_id) REFERENCES dealer_codes(id),
  CONSTRAINT fk_bookings_region FOREIGN KEY (region_id) REFERENCES regions(id),
  CONSTRAINT fk_bookings_area FOREIGN KEY (assigned_area_manager_id) REFERENCES users(id),
  CONSTRAINT fk_bookings_regional FOREIGN KEY (assigned_regional_manager_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(80) PRIMARY KEY,
  token_digest CHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP(6) NOT NULL,
  revoked_at TIMESTAMP(6) NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_sessions_digest (token_digest),
  KEY ix_sessions_user_active (user_id, revoked_at, expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(80) PRIMARY KEY,
  token_digest CHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP(6) NOT NULL,
  used_at TIMESTAMP(6) NULL,
  revoked_at TIMESTAMP(6) NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_password_reset_digest (token_digest),
  KEY ix_password_reset_user_active (user_id, used_at, revoked_at, expires_at),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS onboarding_workflows (
  id VARCHAR(80) PRIMARY KEY,
  owner_user_id VARCHAR(64) NOT NULL,
  status VARCHAR(40) NOT NULL,
  current_step VARCHAR(40) NOT NULL,
  selected_template_id VARCHAR(80) NULL,
  campaign_id VARCHAR(80) NULL,
  workflow_json JSON NOT NULL,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  KEY ix_onboarding_owner_status (owner_user_id, status, updated_at),
  KEY ix_onboarding_status_updated (status, updated_at),
  CONSTRAINT fk_onboarding_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_template_samples (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  type VARCHAR(60) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  sample_json JSON NOT NULL,
  reviewed_at TIMESTAMP(6) NULL,
  UNIQUE KEY uq_email_template_samples_name (name),
  KEY ix_email_template_samples_type_status (type, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_templates (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  type VARCHAR(60) NOT NULL,
  status ENUM('draft', 'active', 'inactive', 'archived') NOT NULL DEFAULT 'draft',
  current_version INT UNSIGNED NOT NULL DEFAULT 1,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  KEY ix_email_templates_type_status (type, status, updated_at),
  CONSTRAINT fk_email_templates_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_template_versions (
  template_id VARCHAR(80) NOT NULL,
  version INT UNSIGNED NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body_text TEXT NOT NULL,
  body_html MEDIUMTEXT NULL,
  content_json JSON NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (template_id, version),
  CONSTRAINT fk_template_versions_template FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE CASCADE,
  CONSTRAINT fk_template_versions_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_campaigns (
  id VARCHAR(80) PRIMARY KEY,
  workflow_id VARCHAR(80) NULL,
  template_id VARCHAR(80) NOT NULL,
  template_version INT UNSIGNED NOT NULL,
  idempotency_key VARCHAR(160) NOT NULL,
  status VARCHAR(40) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  campaign_json JSON NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_email_campaigns_idempotency (idempotency_key),
  KEY ix_email_campaigns_status_updated (status, updated_at),
  CONSTRAINT fk_campaign_workflow FOREIGN KEY (workflow_id) REFERENCES onboarding_workflows(id),
  CONSTRAINT fk_campaign_template_version FOREIGN KEY (template_id, template_version) REFERENCES email_template_versions(template_id, version),
  CONSTRAINT fk_campaign_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_recipients (
  id VARCHAR(80) PRIMARY KEY,
  campaign_id VARCHAR(80) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(180) NOT NULL,
  status VARCHAR(40) NOT NULL,
  attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMP(6) NULL,
  last_error_code VARCHAR(80) NULL,
  submitted_at TIMESTAMP(6) NULL,
  delivered_at TIMESTAMP(6) NULL,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_email_recipient_campaign_user (campaign_id, user_id),
  UNIQUE KEY uq_email_recipient_idempotency (idempotency_key),
  KEY ix_email_recipient_retry (status, next_attempt_at),
  CONSTRAINT fk_email_recipient_campaign FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_email_recipient_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activation_tokens (
  id VARCHAR(80) PRIMARY KEY,
  token_digest CHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  recipient_id VARCHAR(80) NULL,
  expires_at TIMESTAMP(6) NOT NULL,
  used_at TIMESTAMP(6) NULL,
  revoked_at TIMESTAMP(6) NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_activation_token_digest (token_digest),
  KEY ix_activation_user_active (user_id, used_at, revoked_at, expires_at),
  CONSTRAINT fk_activation_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_activation_recipient FOREIGN KEY (recipient_id) REFERENCES email_recipients(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_delivery_events (
  id VARCHAR(80) PRIMARY KEY,
  recipient_id VARCHAR(80) NOT NULL,
  event_type VARCHAR(60) NOT NULL,
  provider_event_id VARCHAR(160) NULL,
  event_json JSON NOT NULL,
  occurred_at TIMESTAMP(6) NOT NULL,
  UNIQUE KEY uq_delivery_provider_event (provider_event_id),
  KEY ix_delivery_recipient_time (recipient_id, occurred_at),
  CONSTRAINT fk_delivery_recipient FOREIGN KEY (recipient_id) REFERENCES email_recipients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS file_uploads (
  id VARCHAR(80) PRIMARY KEY,
  upload_category VARCHAR(60) NOT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  status VARCHAR(40) NOT NULL,
  uploaded_by VARCHAR(64) NOT NULL,
  total_rows INT UNSIGNED NOT NULL DEFAULT 0,
  inserted_rows INT UNSIGNED NOT NULL DEFAULT 0,
  updated_rows INT UNSIGNED NOT NULL DEFAULT 0,
  failed_rows INT UNSIGNED NOT NULL DEFAULT 0,
  result_json JSON NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY ix_file_uploads_category_time (upload_category, created_at),
  KEY ix_file_uploads_status_time (status, created_at),
  CONSTRAINT fk_file_uploads_user FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(80) PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NULL,
  actor_user_id VARCHAR(64) NULL,
  request_id VARCHAR(80) NULL,
  outcome VARCHAR(40) NOT NULL,
  details_json JSON NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY ix_audit_action_time (action, created_at),
  KEY ix_audit_entity_time (entity_type, entity_id, created_at),
  KEY ix_audit_actor_time (actor_user_id, created_at),
  KEY ix_audit_request (request_id),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(80) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  type VARCHAR(60) NOT NULL,
  title VARCHAR(180) NOT NULL,
  message VARCHAR(500) NOT NULL,
  entity_id VARCHAR(80) NULL,
  read_at TIMESTAMP(6) NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY ix_notifications_user_unread (user_id, read_at, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_provider_connections (
  id VARCHAR(80) PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  sender_email VARCHAR(254) NOT NULL,
  encrypted_refresh_token MEDIUMTEXT NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  connected_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_provider_sender (provider, sender_email),
  CONSTRAINT fk_provider_connection_user FOREIGN KEY (connected_by) REFERENCES users(id)
) ENGINE=InnoDB;

