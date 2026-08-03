import assert from "node:assert/strict";
import test from "node:test";
import { validateRuntimeConfig } from "../src/config.js";

test("production allows localhost Docker smoke configuration", () => {
  assert.deepEqual(validateRuntimeConfig({
    NODE_ENV: "production",
    APP_URL: "http://localhost:3000",
    SESSION_COOKIE_SECURE: "false",
    DATABASE_URL: "mysql://booking_app:secret@mysql:3306/booking_dashboard",
    REDIS_URL: "redis://redis:6379",
    GOOGLE_REDIRECT_URI: "http://localhost:3000/api/admin/email-provider/google/callback"
  }), {
    appUrl: "http://localhost:3000/",
    production: true
  });
});

test("production rejects public HTTP application origins", () => {
  assert.throws(() => validateRuntimeConfig({
    NODE_ENV: "production",
    APP_URL: "http://booking.example.com"
  }), /APP_URL must use HTTPS/);
});

test("production rejects insecure cookies on public origins", () => {
  assert.throws(() => validateRuntimeConfig({
    NODE_ENV: "production",
    APP_URL: "https://booking.example.com",
    SESSION_COOKIE_SECURE: "false"
  }), /SESSION_COOKIE_SECURE=false/);
});

test("runtime config validates dependency URL protocols", () => {
  assert.throws(() => validateRuntimeConfig({ DATABASE_URL: "postgres://example" }), /DATABASE_URL must use the mysql protocol/);
  assert.throws(() => validateRuntimeConfig({ REDIS_URL: "http://redis" }), /REDIS_URL must use redis or rediss protocol/);
});

test("production OAuth redirect must be secure and share the app origin", () => {
  assert.throws(() => validateRuntimeConfig({
    NODE_ENV: "production",
    APP_URL: "https://booking.example.com",
    GOOGLE_REDIRECT_URI: "https://evil.example.com/callback"
  }), /GOOGLE_REDIRECT_URI must share the APP_URL origin/);
  assert.throws(() => validateRuntimeConfig({
    NODE_ENV: "production",
    APP_URL: "https://booking.example.com",
    GOOGLE_REDIRECT_URI: "http://booking.example.com/callback"
  }), /GOOGLE_REDIRECT_URI must use HTTPS/);
});