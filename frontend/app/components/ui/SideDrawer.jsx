"use client";

import useDialogLifecycle from "./useDialogLifecycle";

export default function SideDrawer({
  children,
  className = "",
  backdropClassName = "",
  labelledBy,
  describedBy,
  closeDisabled = false,
  onClose
}) {
  const drawerRef = useDialogLifecycle({ active: true, closeDisabled, onClose });

  return (
    <div
      className={`modal-backdrop side-drawer-backdrop ${backdropClassName}`.trim()}
      onMouseDown={(event) => event.target === event.currentTarget && !closeDisabled && onClose?.()}
    >
      <aside
        ref={drawerRef}
        className={`modal side-drawer ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
      >
        {children}
      </aside>
    </div>
  );
}
