import Button from "./ui/Button";
import NotificationToast from "./NotificationToast";
import ProfileMenu from "./ProfileMenu";

export default function Topbar({
  title,
  subtitle,
  user,
  notice,
  notificationCount = 0,
  notificationsOpen,
  onNotificationsClick,
  onEditProfile,
  onChangePassword,
  onLogout,
  onNoticeClose,
  onMenuClick
}) {
  return (
    <>
      <div className="topbar">
        <div className="topbar-title-group">
          <Button
            className="icon-button mobile-nav-trigger"
            variant="ghost"
            type="button"
            aria-label="Open main navigation"
            aria-haspopup="dialog"
            onClick={onMenuClick}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </Button>
          <div className="title">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </div>
        <div className="actions topbar-account-tools">
          {user ? (
            <Button
              className={`icon-button topbar-notification${notificationsOpen ? " active" : ""}`}
              variant="ghost"
              type="button"
              title="Notifications"
              aria-label={`Notifications${notificationCount ? `, ${notificationCount} unread` : ""}`}
              aria-expanded={notificationsOpen}
              onClick={onNotificationsClick}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
                <path
                  d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M13.73 21a2 2 0 0 1-3.46 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {notificationCount ? (
                <span className="notification-count">{notificationCount > 99 ? "99+" : notificationCount}</span>
              ) : null}
            </Button>
          ) : null}
          <ProfileMenu
            user={user}
            onEditProfile={onEditProfile}
            onChangePassword={onChangePassword}
            onLogout={onLogout}
          />
        </div>
      </div>
      <NotificationToast notice={notice} onClose={onNoticeClose} />
    </>
  );
}