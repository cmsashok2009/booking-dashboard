"use client";

import Link from "next/link";

import BrandLogo from "./BrandLogo";
import Button from "./ui/Button";
import Field from "./ui/Field";
import TextInput from "./ui/TextInput";

export default function Login({ notice, onLogin }) {
  return (
    <main className="login">
      <section className="login-card">
        <BrandLogo className="login-brand" />
        <h1>Sign in</h1>
        <p>Sign in with your Booking Dashboard account.</p>
        <form onSubmit={onLogin}>
          <Field label="Email" htmlFor="login-email">
            <TextInput
              id="login-email"
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="Enter your email address"
            />
          </Field>
          <Field label="Password" htmlFor="login-password">
            <TextInput
              id="login-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              aria-describedby={notice?.message ? "login-feedback" : undefined}
              aria-invalid={notice?.type === "error"}
            />
          </Field>
          <div className="login-support-row">
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
          {notice?.message ? (
            <div
              id="login-feedback"
              className={`login-feedback ${notice.type === "error" ? "error" : "info"}`}
              role={notice.type === "error" ? "alert" : "status"}
            >
              {notice.message}
            </div>
          ) : null}
          <Button type="submit" busy={notice?.type === "info"} busyLabel="Signing in...">
            Sign in
          </Button>
        </form>
      </section>
    </main>
  );
}
