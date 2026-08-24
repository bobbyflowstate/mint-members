"use client";

import { useState } from "react";
import clsx from "clsx";
import { MemberProfileDialog, type MemberProfileDialogRow } from "./MemberProfileDialog";

const OPS_PASSWORD_KEY = "ops_password";

/**
 * A member's name, clickable anywhere in /ops to pop open their full profile.
 *
 * Reads the ops password itself so a table only has to pass an application id
 * and a name. Renders plain text when there is nothing to open — no id and no
 * row detail means there is no profile behind the name.
 */
export function MemberNameLink({
  applicationId,
  name,
  row,
  className,
}: {
  applicationId?: string;
  name: string;
  /** Extra detail the caller's row holds that the application does not. */
  row?: Omit<MemberProfileDialogRow, "fullName" | "applicationId">;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [opsPassword] = useState<string | null>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem(OPS_PASSWORD_KEY) : null
  );

  const canOpen = Boolean(opsPassword) && (Boolean(applicationId) || Boolean(row));
  if (!canOpen) {
    return <span className={className}>{name}</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          "text-left underline decoration-white/25 underline-offset-4 transition-colors hover:text-emerald-300 hover:decoration-emerald-300",
          className
        )}
      >
        {name}
      </button>
      {open && opsPassword && (
        <MemberProfileDialog
          row={{ ...row, applicationId, fullName: name }}
          opsPassword={opsPassword}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
