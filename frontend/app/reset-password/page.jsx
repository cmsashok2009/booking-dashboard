"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import PasswordFields, { isStrongPassword } from "../components/PasswordFields";
import { request } from "../utils/api";
import BrandLogo from "../components/BrandLogo";
import Button from "../components/ui/Button";
import LoadingState from "../components/ui/LoadingState";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    const rawToken = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token") || "";
    window.history.replaceState({}, "", window.location.pathname);
    setToken(rawToken);
    if (!rawToken) {
      setStatus("invalid");
      setError("This password reset link is incomplete.");
      return;
    }
    request("/api/auth/password/reset/validate", { method: "POST", body: JSON.stringify({ token: rawToken }) })
      .then((result) => {
        setEmail(result.email);
        setStatus("ready");
      })
      .catch((requestError) => {
        setError(requestError.message);
        setStatus("invalid");
      });
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!isStrongPassword(password) || password !== confirmPassword) {
      setError(
        password !== confirmPassword ? "Passwords do not match." : "Password does not meet all security requirements."
      );
      return;
    }
    setStatus("saving");
    try {
      await request("/api/auth/password/reset", {
        method: "POST",
        body: JSON.stringify({ token, password, confirmPassword })
      });
      setPassword("");
      setConfirmPassword("");
      setToken("");
      setStatus("complete");
    } catch (requestError) {
      setError(requestError.payload?.errors?.join(". ") || requestError.message);
      setStatus("ready");
    }
  }

  return (
    <main className="activation-page">
      <section className="activation-shell" aria-live="polite">
        <BrandLogo className="activation-brand" />
        {status === "checking" ? (
          <LoadingState title="Checking your reset link" description="Validating this secure password-reset request." />
        ) : null}
        {status === "invalid" ? (
          <div className="activation-state">
            <span className="activation-state-icon error" aria-hidden="true">
              ×
            </span>
            <h1>Reset link unavailable</h1>
            <p>{error}</p>
            <Link className="button-link" href="/forgot-password">
              Request a new link
            </Link>
          </div>
        ) : null}
        {status === "complete" ? (
          <div className="activation-state">
            <span className="activation-state-icon success" aria-hidden="true">
              ✓
            </span>
            <h1>Password updated</h1>
            <p>You can now sign in with your new password.</p>
            <Link className="button-link" href="/">
              Continue to sign in
            </Link>
          </div>
        ) : null}
        {["ready", "saving"].includes(status) ? (
          <>
            <header className="activation-header">
              <span className="modal-eyebrow">Account recovery</span>
              <h1>Create a new password</h1>
              <p>
                Set a new password for <strong>{email}</strong>.
              </p>
            </header>
            <form className="activation-form auth-form-spacing" onSubmit={submit} noValidate>
              <PasswordFields
                password={password}
                confirmPassword={confirmPassword}
                onPasswordChange={setPassword}
                onConfirmPasswordChange={setConfirmPassword}
                showPassword={showPassword}
                onVisibilityChange={setShowPassword}
                prefix="reset-password"
              />
              {error ? (
                <div className="activation-error" role="alert">
                  {error}
                </div>
              ) : null}
              <Button type="submit" busy={status === "saving"} busyLabel="Updating password...">
                Update password
              </Button>
            </form>
          </>
        ) : null}
      </section>
    </main>
  );
}
