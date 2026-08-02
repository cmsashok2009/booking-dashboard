"use client";

import Link from "next/link";

import { useState } from "react";
import { request } from "../utils/api";
import BrandLogo from "../components/BrandLogo";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
import TextInput from "../components/ui/TextInput";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("ready");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    try {
      const result = await request("/api/auth/password/forgot", { method: "POST", body: JSON.stringify({ email }) });
      setMessage(result.message);
      setStatus("complete");
    } catch {
      setMessage("We could not process your request. Please try again.");
      setStatus("error");
    }
  }

  return (
    <main className="activation-page">
      <section className="activation-shell">
        <BrandLogo className="activation-brand" />
        <header className="activation-header">
          <span className="modal-eyebrow">Account recovery</span>
          <h1>Forgot your password?</h1>
          <p>Enter your login email and we’ll send a secure reset link if the account is active.</p>
        </header>
        {status === "complete" ? (
          <div className="auth-result success" role="status">
            <strong>Check your email</strong>
            <p>{message}</p>
          </div>
        ) : null}
        {status !== "complete" ? (
          <form className="activation-form auth-form-spacing" onSubmit={submit}>
            <Field label="Email" htmlFor="recovery-email" required>
              <TextInput
                id="recovery-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="Enter your email address"
              />
            </Field>
            {status === "error" ? (
              <div className="activation-error" role="alert">
                {message}
              </div>
            ) : null}
            <Button type="submit" busy={status === "sending"} busyLabel="Sending reset link...">
              Send reset link
            </Button>
          </form>
        ) : null}
        <Link className="auth-back-link" href="/">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
