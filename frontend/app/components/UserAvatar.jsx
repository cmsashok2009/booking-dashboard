import { userInitials } from "../utils/users";

export default function UserAvatar({ user, size = "md" }) {
  return (
    <span className={`user-avatar user-avatar-${size}`} aria-hidden="true">
      {user?.avatarUrl ? (
        // Dynamic profile data may be a blob/data URL and is already rendered at a constrained CSS size.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" />
      ) : (
        userInitials(user)
      )}
    </span>
  );
}
