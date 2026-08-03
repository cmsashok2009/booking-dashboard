function parseUrl(name, value) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}

function isLocalHost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(String(hostname || "").toLowerCase());
}

function isSecurePublicUrl(url) {
  return url.protocol === "https:" || (url.protocol === "http:" && isLocalHost(url.hostname));
}

function parseBoolean(name, value) {
  if (value === undefined || value === "") return undefined;
  if (["true", "false"].includes(String(value).toLowerCase())) return String(value).toLowerCase() === "true";
  throw new Error(`${name} must be true or false`);
}

export function validateRuntimeConfig(environment = process.env) {
  const isProduction = environment.NODE_ENV === "production";
  const appUrl = parseUrl("APP_URL", environment.APP_URL || "http://localhost:3000");
  const sessionCookieSecure = parseBoolean("SESSION_COOKIE_SECURE", environment.SESSION_COOKIE_SECURE);

  if (isProduction) {
    if (!isSecurePublicUrl(appUrl)) throw new Error("Production APP_URL must use HTTPS unless it is localhost");
    if (sessionCookieSecure === false && !isLocalHost(appUrl.hostname)) {
      throw new Error("SESSION_COOKIE_SECURE=false is allowed only for localhost production smoke tests");
    }
    if (environment.ALLOW_DEMO_CREDENTIALS === "true") throw new Error("Demo credentials are not allowed in production");
  }

  const databaseUrl = parseUrl("DATABASE_URL", environment.DATABASE_URL);
  if (databaseUrl && !["mysql:", "mysql2:"].includes(databaseUrl.protocol)) {
    throw new Error("DATABASE_URL must use the mysql protocol");
  }

  const redisUrl = parseUrl("REDIS_URL", environment.REDIS_URL);
  if (redisUrl && !["redis:", "rediss:"].includes(redisUrl.protocol)) {
    throw new Error("REDIS_URL must use redis or rediss protocol");
  }

  const googleRedirectUri = parseUrl("GOOGLE_REDIRECT_URI", environment.GOOGLE_REDIRECT_URI);
  if (googleRedirectUri) {
    if (isProduction && !isSecurePublicUrl(googleRedirectUri)) {
      throw new Error("Production GOOGLE_REDIRECT_URI must use HTTPS unless it is localhost");
    }
    if (googleRedirectUri.origin !== appUrl.origin) {
      throw new Error("GOOGLE_REDIRECT_URI must share the APP_URL origin");
    }
  }

  return { appUrl: appUrl.toString(), production: isProduction };
}