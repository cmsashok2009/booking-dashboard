import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../app/utils/api", () => ({ request }));
import EmailSettingsView from "../../app/components/EmailSettingsView";

beforeEach(() => {
  vi.clearAllMocks();
  request.mockReset();
});

function props(provider, overrides = {}) {
  return { provider, user: { email: "admin@example.com" }, onReload: vi.fn(), setNotice: vi.fn(), ...overrides };
}

describe("email provider settings", () => {
  it("shows missing server configuration and disables connection", () => {
    render(<EmailSettingsView {...props({ configured: false, connected: false, missing: ["GOOGLE_CLIENT_ID"] })} />);
    expect(screen.getByRole("status")).toHaveTextContent("GOOGLE_CLIENT_ID");
    expect(screen.getByRole("button", { name: "Connect Google account" })).toBeDisabled();
    expect(screen.getByText("Setup required")).toBeInTheDocument();
  });

  it("opens Google authorization and handles success and failure messages", async () => {
    const values = props({ configured: true, connected: false });
    const popup = { focus: vi.fn(), closed: false };
    const open = vi.spyOn(window, "open").mockReturnValue(popup);
    request.mockResolvedValueOnce({ authorizationUrl: "https://accounts.google.com/auth" });
    render(<EmailSettingsView {...values} />);
    await userEvent.click(screen.getByRole("button", { name: "Connect Google account" }));
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining("google.com"),
      "booking-google-oauth",
      expect.any(String)
    );
    expect(popup.focus).toHaveBeenCalledOnce();

    fireEvent(
      window,
      new MessageEvent("message", {
        origin: window.location.origin,
        data: { type: "booking-google-oauth", ok: true, message: "Connected" }
      })
    );
    await waitFor(() => expect(values.onReload).toHaveBeenCalledOnce());
    expect(values.setNotice).toHaveBeenCalledWith({ type: "success", message: "Connected" });

    fireEvent(
      window,
      new MessageEvent("message", { origin: window.location.origin, data: { type: "booking-google-oauth", ok: false } })
    );
    await waitFor(() =>
      expect(values.setNotice).toHaveBeenCalledWith({ type: "error", message: "Google account connection failed." })
    );
    fireEvent(
      window,
      new MessageEvent("message", {
        origin: "https://attacker.example",
        data: { type: "booking-google-oauth", ok: true }
      })
    );
    open.mockRestore();
  });

  it("reports blocked and failed Google connection attempts", async () => {
    const values = props({ configured: true, connected: false });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    request.mockResolvedValueOnce({ authorizationUrl: "https://accounts.google.com/auth" });
    render(<EmailSettingsView {...values} />);
    await userEvent.click(screen.getByRole("button", { name: "Connect Google account" }));
    expect(values.setNotice).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", message: expect.stringContaining("blocked") })
    );
    open.mockRestore();
  });

  it("sends test mail, changes accounts, and confirms disconnection", async () => {
    const provider = {
      configured: true,
      connected: true,
      accountEmail: "sender@example.com",
      connectedAt: "2026-08-01T10:00:00Z",
      lastTestAt: null
    };
    const values = props(provider);
    const popup = { focus: vi.fn(), closed: false };
    const open = vi.spyOn(window, "open").mockReturnValue(popup);
    request
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ authorizationUrl: "https://accounts.google.com/auth" })
      .mockResolvedValueOnce({});
    render(<EmailSettingsView {...values} />);

    const recipient = screen.getByLabelText(/Test recipient/);
    await userEvent.clear(recipient);
    await userEvent.type(recipient, "qa@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send test email" }));
    expect(values.setNotice).toHaveBeenCalledWith({ type: "success", message: "Test email sent to qa@example.com." });

    await userEvent.click(screen.getByRole("button", { name: "Change Google account" }));
    fireEvent(
      window,
      new MessageEvent("message", { origin: window.location.origin, data: { type: "booking-google-oauth", ok: true } })
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Disconnect" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Keep connected" }));
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await userEvent.click(screen.getByRole("button", { name: "Disconnect account" }));
    expect(values.setNotice).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", message: expect.stringContaining("disconnected") })
    );
    open.mockRestore();
  });

  it("reports test and disconnect API errors", async () => {
    const values = props({ configured: true, connected: true, accountEmail: "sender@example.com" });
    request
      .mockRejectedValueOnce({ message: "Send failed", payload: { error: "Provider rejected" } })
      .mockRejectedValueOnce(new Error("Disconnect failed"));
    render(<EmailSettingsView {...values} />);
    await userEvent.click(screen.getByRole("button", { name: "Send test email" }));
    expect(values.setNotice).toHaveBeenCalledWith({ type: "error", message: "Provider rejected" });
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await userEvent.click(screen.getByRole("button", { name: "Disconnect account" }));
    expect(values.setNotice).toHaveBeenLastCalledWith({ type: "error", message: "Disconnect failed" });
  });
});
