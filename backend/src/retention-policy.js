export function applyRetentionPolicy(data, now = Date.now()) {
  const expired = (value) => value && Date.parse(value) <= now;
  const olderThan = (value, days) =>
    value && Date.parse(value) < now - days * 24 * 60 * 60 * 1000;
  data.sessions = (data.sessions || []).filter(
    (item) => !olderThan(item.revokedAt || item.expiresAt, 7),
  );
  data.passwordResetTokens = (data.passwordResetTokens || []).filter(
    (item) => !olderThan(item.usedAt || item.revokedAt || item.expiresAt, 7),
  );
  data.activationTokens = (data.activationTokens || []).filter(
    (item) => !olderThan(item.usedAt || item.revokedAt || item.expiresAt, 30),
  );
  data.emailOAuthStates = (data.emailOAuthStates || []).filter(
    (item) => !item.usedAt && !expired(item.expiresAt),
  );
  data.fileUploads = (data.fileUploads || []).filter(
    (item) =>
      !olderThan(
        item.createdAt || item.uploadedAt,
        Number(process.env.UPLOAD_RETENTION_DAYS || 30),
      ),
  );
  data.auditLogs = (data.auditLogs || []).filter(
    (item) =>
      !olderThan(
        item.createdAt,
        Number(process.env.AUDIT_RETENTION_DAYS || 365),
      ),
  );
}
