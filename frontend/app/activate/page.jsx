"use client";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";
import { request } from "../utils/api";
import PasswordRevealButton from "../components/PasswordRevealButton";
import BrandLogo from "../components/BrandLogo";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
import TextInput from "../components/ui/TextInput";
import LoadingState from "../components/ui/LoadingState";

const RULES = [
  { label: "At least 10 characters", test: (value) => value.length >= 10 },
  { label: "One uppercase letter", test: (value) => /[A-Z]/.test(value) },
  { label: "One lowercase letter", test: (value) => /[a-z]/.test(value) },
  { label: "One number", test: (value) => /[0-9]/.test(value) }
];

export default function ActivateAccountPage() {
  const [token, setToken] = useState("");
  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const rawToken = params.get("token") || "";
    window.history.replaceState({}, "", window.location.pathname);
    setToken(rawToken);
    if (!rawToken) {
      setStatus("invalid");
      setError("This activation link is incomplete. Ask your administrator for a new invitation.");
      return;
    }
    request("/api/auth/activation/validate", { method: "POST", body: JSON.stringify({ token: rawToken }) })
      .then((payload) => {
        setAccount(payload.user);
        setStatus("ready");
      })
      .catch((requestError) => {
        setStatus("invalid");
        setError(requestError.message);
      });
  }, []);

  const passedRules = useMemo(() => RULES.filter((rule) => rule.test(password)).length, [password]);
  const formValid = passedRules === RULES.length && password === confirmPassword;

  async function activate(event) {
    event.preventDefault();
    setError("");
    if (!formValid) {
      setError(
        password !== confirmPassword ? "Passwords do not match." : "Password does not meet all security requirements."
      );
      return;
    }
    setStatus("saving");
    try {
      await request("/api/auth/activation/complete", {
        method: "POST",
        body: JSON.stringify({ token, password, confirmPassword })
      });
      setToken("");
      setPassword("");
      setConfirmPassword("");
      setStatus("complete");
    } catch (requestError) {
      setStatus("ready");
      setError(requestError.payload?.errors?.join(". ") || requestError.message);
    }
  }

  return (
    <main className="activation-page">
      <section className="activation-shell" aria-live="polite">
        <BrandLogo className="activation-brand" />
        {status === "checking" ? (
          <LoadingState title="Checking your invitation" description="Validating this secure activation link." />
        ) : null}
        {status === "invalid" ? (
          <div className="activation-state">
            <span className="activation-state-icon error" aria-hidden="true">
              ×
            </span>
            <h1>Activation link unavailable</h1>
            <p>{error}</p>
            <Link className="button-link" href="/">
              Return to login
            </Link>
          </div>
        ) : null}
        {status === "complete" ? (
          <div className="activation-state">
            <span className="activation-state-icon success" aria-hidden="true">
              ✓
            </span>
            <h1>Your account is ready</h1>
            <p>Your password has been created. Sign in using the email address from your invitation.</p>
            <Link className="button-link" href="/">
              Continue to login
            </Link>
          </div>
        ) : null}
        {["ready", "saving"].includes(status) ? (
          <>
            <header className="activation-header">
              <span className="modal-eyebrow">Secure account setup</span>
              <h1>Create your password</h1>
              <p>
                Welcome, {account?.name}. Set a password for <strong>{account?.email}</strong>.
              </p>
            </header>
            <div className="activation-account">
              <div>
                <span>Role</span>
                <strong>{account?.role}</strong>
              </div>
              <div>
                <span>Region</span>
                <strong>{account?.region || "All"}</strong>
              </div>
            </div>
            <form className="activation-form" onSubmit={activate} noValidate>
              <Field label="New password" htmlFor="new-password" required>
                <div className="password-control">
                  <TextInput
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    aria-describedby="password-rules"
                  />
                  <PasswordRevealButton onVisibilityChange={setShowPassword} />
                </div>
              </Field>
              <Field
                label="Confirm password"
                htmlFor="confirm-password"
                required
                error={confirmPassword && password !== confirmPassword ? "Passwords do not match." : ""}
              >
                <TextInput
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  aria-invalid={Boolean(confirmPassword && password !== confirmPassword)}
                />
              </Field>
              <div id="password-rules" className="password-rules">
                <div>
                  <strong>Password strength</strong>
                  <span>
                    {passedRules} of {RULES.length} requirements
                  </span>
                </div>
                <ul>
                  {RULES.map((rule) => (
                    <li className={rule.test(password) ? "passed" : ""} key={rule.label}>
                      <span aria-hidden="true">{rule.test(password) ? "✓" : "·"}</span>
                      {rule.label}
                    </li>
                  ))}
                </ul>
              </div>
              {error ? (
                <div className="activation-error" role="alert">
                  {error}
                </div>
              ) : null}
              <Button type="submit" busy={status === "saving"} busyLabel="Activating account...">
                Activate account
              </Button>
            </form>
          </>
        ) : null}
      </section>
    </main>
  );
}
