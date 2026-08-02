import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("../../app/utils/api", () => ({ request }));
import ChangePasswordModal from "../../app/components/ChangePasswordModal";
import Login from "../../app/components/Login";
import PasswordFields, { isStrongPassword } from "../../app/components/PasswordFields";
import ProfileMenu from "../../app/components/ProfileMenu";
import Topbar from "../../app/components/Topbar";
import UserAvatar from "../../app/components/UserAvatar";
const user = { name: "Admin User", email: "admin@example.com", role: "Admin", region: "North" };
beforeEach(() => {
  vi.clearAllMocks();
  request.mockReset();
});
describe("account navigation", () => {
  it("presents login errors, submits, and exposes busy state", async () => {
    const onLogin = vi.fn((event) => event.preventDefault());
    const { rerender } = render(<Login notice={{ type: "error", message: "Invalid credentials" }} onLogin={onLogin} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials");
    await userEvent.type(screen.getByLabelText("Email"), "admin@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onLogin).toHaveBeenCalledOnce();
    rerender(<Login notice={{ type: "info", message: "Checking" }} onLogin={onLogin} />);
    expect(screen.getByRole("button", { name: /Signing in/ })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
  });
  it("checks password strength, mismatch, changes, and hold-to-reveal", async () => {
    const change = vi.fn(),
      confirm = vi.fn(),
      visible = vi.fn();
    expect(isStrongPassword("Abcdefghi1")).toBe(true);
    expect(isStrongPassword("Abcdefgh1")).toBe(false);
    expect(isStrongPassword("abcdefghij")).toBe(false);
    expect(isStrongPassword("ABCDEFGHI1")).toBe(false);
    render(
      <PasswordFields
        password="StrongPass123"
        confirmPassword="different"
        onPasswordChange={change}
        onConfirmPasswordChange={confirm}
        showPassword={false}
        onVisibilityChange={visible}
      />
    );
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(screen.getByText("4 of 4 requirements")).toBeInTheDocument();
    expect(screen.getAllByText("✓", { selector: ".password-rule-icon" })).toHaveLength(4);
    expect(screen.queryByText("OK", { selector: ".password-rule-icon" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/New password/), "x");
    await userEvent.type(screen.getByLabelText(/Confirm password/), "x");
    const reveal = screen.getByRole("button", { name: "Hold to show password" });
    fireEvent.pointerDown(reveal);
    fireEvent.pointerUp(reveal);
    fireEvent.keyDown(reveal, { key: "Enter" });
    fireEvent.keyUp(reveal, { key: "Enter" });
    expect(change).toHaveBeenCalled();
    expect(confirm).toHaveBeenCalled();
    expect(visible).toHaveBeenCalledWith(true);
    expect(visible).toHaveBeenLastCalledWith(false);
  });
  it("validates, reports an API error, and completes password changes", async () => {
    const onComplete = vi.fn();
    const first = render(<ChangePasswordModal open onClose={vi.fn()} onComplete={onComplete} />);
    await userEvent.type(screen.getByLabelText(/New password/), "weak");
    await userEvent.type(screen.getByLabelText(/Confirm password/), "other");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Passwords do not match");
    first.unmount();
    request.mockRejectedValueOnce({ message: "Failed", payload: { errors: ["Current password is wrong"] } });
    const second = render(<ChangePasswordModal open onClose={vi.fn()} onComplete={onComplete} />);
    for (const pair of [
      ["Current password", "old-password"],
      ["New password", "StrongPass123"],
      ["Confirm password", "StrongPass123"]
    ])
      await userEvent.type(screen.getByLabelText(new RegExp(pair[0])), pair[1]);
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is wrong");
    second.unmount();
    request.mockResolvedValueOnce({});
    render(<ChangePasswordModal open onClose={vi.fn()} onComplete={onComplete} />);
    for (const pair of [
      ["Current password", "old-password"],
      ["New password", "StrongPass123"],
      ["Confirm password", "StrongPass123"]
    ])
      await userEvent.type(screen.getByLabelText(new RegExp(pair[0])), pair[1]);
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  });
  it("selects profile actions and closes the menu externally", async () => {
    const edit = vi.fn();
    render(<ProfileMenu user={user} onEditProfile={edit} onChangePassword={vi.fn()} onLogout={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /Admin User/ });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit profile photo" }));
    expect(edit).toHaveBeenCalledOnce();
    await userEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await userEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
  it("renders avatar variants and admin notification state", async () => {
    const { container, rerender } = render(<UserAvatar user={user} />);
    expect(container.querySelector(".user-avatar")).toHaveTextContent("AU");
    rerender(<UserAvatar user={{ ...user, avatarUrl: "data:image/png;base64,AA" }} size="lg" />);
    expect(container.querySelector("img")).toBeInTheDocument();
    const click = vi.fn();
    const common = { onEditProfile: vi.fn(), onChangePassword: vi.fn(), onLogout: vi.fn() };
    rerender(
      <Topbar
        title="Dashboard"
        subtitle="Overview"
        user={user}
        notificationCount={120}
        notificationsOpen
        onNotificationsClick={click}
        {...common}
      />
    );
    expect(screen.getByText("99+")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Notifications, 120 unread" }));
    expect(click).toHaveBeenCalledOnce();
    rerender(
      <Topbar
        title="Bookings"
        subtitle="Assigned"
        user={{ ...user, role: "Area Manager" }}
        onNotificationsClick={click}
        {...common}
      />
    );
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });
});
