"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "./ui/Button";
import Field from "./ui/Field";
import TextInput from "./ui/TextInput";
import { request } from "../utils/api";

export default function EmailSettingsView({ provider, user, onReload, setNotice }) {
  const [busy, setBusy] = useState("");
  const [testEmail, setTestEmail] = useState(user?.email || "");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const popupRef = useRef(null);
  const busyRef = useRef(busy);
  const connectionResolvedRef = useRef(true);

  const clearPendingConnection = useCallback(() => {
    popupRef.current = null;
    setBusy("");
  }, []);

  const finishConnectionAttempt = useCallback(() => {
    connectionResolvedRef.current = true;
    clearPendingConnection();
  }, [clearPendingConnection]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    const receiveOAuthResult = async (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== "booking-google-oauth") return;
      finishConnectionAttempt();
      if (event.data.ok) {
        await onReload();
        setNotice({ type: "success", message: event.data.message || "Google sender account connected." });
      } else {
        setNotice({ type: "error", message: event.data.message || "Google account connection failed." });
      }
    };

    const handleWindowFocus = () => {
      if (busyRef.current !== "connect") return;
      if (!popupRef.current || popupRef.current.closed) {
        connectionResolvedRef.current = true;
        clearPendingConnection();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible" || busyRef.current !== "connect") return;
      if (!popupRef.current || popupRef.current.closed) {
        connectionResolvedRef.current = true;
        clearPendingConnection();
      }
    };

    window.addEventListener("message", receiveOAuthResult);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("message", receiveOAuthResult);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearPendingConnection, finishConnectionAttempt, onReload, setNotice]);

  useEffect(() => {
    if (busy !== "connect") return undefined;

    const timer = window.setInterval(() => {
      try {
        if (!connectionResolvedRef.current && (!popupRef.current || popupRef.current.closed)) {
          connectionResolvedRef.current = true;
          clearPendingConnection();
          setNotice({ type: "warning", message: "Google sign-in was closed before authorization completed." });
        }
      } catch {
        connectionResolvedRef.current = true;
        clearPendingConnection();
      }
    }, 500);

    return () => window.clearInterval(timer);
  }, [busy, clearPendingConnection, setNotice]);

  async function connectGoogle() {
    setBusy("connect");
    connectionResolvedRef.current = false;
    try {
      const { authorizationUrl } = await request("/api/admin/email-provider/google/start", { method: "POST" });
      const popup = window.open(
        authorizationUrl,
        "booking-google-oauth",
        "popup=yes,width=560,height=720,noopener=no,noreferrer=no"
      );
      if (!popup) throw new Error("Your browser blocked the Google connection window. Allow pop-ups and try again.");
      popupRef.current = popup;
      popup.focus();
    } catch (error) {
      popupRef.current = null;
      connectionResolvedRef.current = true;
      setBusy("");
      setNotice({ type: "error", message: error.payload?.error || error.message });
    }
  }

  async function sendTest(event) {
    event.preventDefault();
    setBusy("test");
    try {
      await request("/api/admin/email-provider/google/test", {
        method: "POST",
        body: JSON.stringify({ recipientEmail: testEmail })
      });
      await onReload();
      setNotice({ type: "success", message: `Test email sent to ${testEmail}.` });
    } catch (error) {
      setNotice({ type: "error", message: error.payload?.error || error.message });
    } finally {
      setBusy("");
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    try {
      await request("/api/admin/email-provider/google/disconnect", { method: "POST" });
      await onReload();
      setConfirmDisconnect(false);
      setNotice({
        type: "success",
        message: "Google sender account disconnected and its stored authorization removed."
      });
    } catch (error) {
      setNotice({ type: "error", message: error.payload?.error || error.message });
    } finally {
      setBusy("");
    }
  }

  const configured = Boolean(provider?.configured);
  const connected = Boolean(provider?.connected);

  return (
    <div className="page-content email-settings-page">
      <section className="email-content-section email-provider-panel" aria-labelledby="google-sender-heading">
        <div className="email-provider-heading">
          <div className="provider-mark" aria-hidden="true">
            G
          </div>
          <div>
            <h2 id="google-sender-heading">Google sender account</h2>
            <p>Send activation emails through the Gmail API using an authorized organization account.</p>
          </div>
          <span className={`provider-state ${connected ? "is-connected" : ""}`}>
            {connected ? "Connected" : configured ? "Not connected" : "Setup required"}
          </span>
        </div>

        {!configured ? (
          <div className="settings-callout warning" role="status">
            <strong>Google Cloud configuration is incomplete</strong>
            <p>Add the following server variables, restart the backend, then connect the sender account.</p>
            <div className="config-key-list">
              {(provider?.missing || []).map((key) => (
                <code key={key}>{key}</code>
              ))}
            </div>
          </div>
        ) : null}

        {connected ? (
          <>
            <dl className="provider-details">
              <div>
                <dt>Authorized account</dt>
                <dd>{provider.accountEmail}</dd>
              </div>
              <div>
                <dt>Connected</dt>
                <dd>{provider.connectedAt ? new Date(provider.connectedAt).toLocaleString() : "NA"}</dd>
              </div>
              <div>
                <dt>Last test</dt>
                <dd>{provider.lastTestAt ? new Date(provider.lastTestAt).toLocaleString() : "Not tested"}</dd>
              </div>
            </dl>
            <form className="email-test-form" onSubmit={sendTest} noValidate>
              <Field label="Test recipient" htmlFor="test-recipient" required>
                <TextInput
                  id="test-recipient"
                  type="email"
                  required
                  value={testEmail}
                  onChange={(event) => setTestEmail(event.target.value)}
                />
              </Field>
              <Button type="submit" busy={busy === "test"} busyLabel="Sending...">
                Send test email
              </Button>
            </form>
            <div className="provider-actions">
              <div>
                <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={connectGoogle}>
                  Change Google account
                </Button>
                <p className="provider-action-note">
                  Changing the sender does not alter users or historical delivery records.
                </p>
              </div>
              {!confirmDisconnect ? (
                <Button
                  type="button"
                  variant="dangerQuiet"
                  disabled={Boolean(busy)}
                  onClick={() => setConfirmDisconnect(true)}
                >
                  Disconnect
                </Button>
              ) : (
                <div className="disconnect-confirm" role="alert">
                  <span>Stop Gmail delivery and remove the stored authorization?</span>
                  <Button type="button" variant="secondary" onClick={() => setConfirmDisconnect(false)}>
                    Keep connected
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    busy={busy === "disconnect"}
                    busyLabel="Disconnecting..."
                    onClick={disconnect}
                  >
                    Disconnect account
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="provider-connect-row">
            <div>
              <strong>No sender account connected</strong>
              <p>Campaign delivery remains disabled until an Admin authorizes a Google account.</p>
            </div>
            <Button
              type="button"
              disabled={!configured || busy === "connect"}
              busy={busy === "connect"}
              busyLabel="Waiting for Google..."
              onClick={connectGoogle}
            >
              Connect Google account
            </Button>
          </div>
        )}
      </section>

      <section className="email-content-section email-security-note">
        <h2>Connection security</h2>
        <div className="security-grid">
          <div>
            <strong>Limited permission</strong>
            <span>Only Gmail message sending is requested.</span>
          </div>
          <div>
            <strong>Encrypted authorization</strong>
            <span>The refresh token is encrypted at rest and never returned to the browser.</span>
          </div>
          <div>
            <strong>Controlled access</strong>
            <span>Only authenticated Admin users can connect, test, change, or disconnect the sender.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
