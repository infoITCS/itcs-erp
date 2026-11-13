import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn.ts";

export function userInitials(firstName?: string, lastName?: string): string {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "U";
}

export function UserAvatar({
  firstName,
  lastName,
  src,
  className,
  fallbackClassName = "bg-slate-700 text-white",
  textClassName = "text-xs",
  children,
}: {
  firstName?: string;
  lastName?: string;
  src?: string | null;
  className?: string;
  fallbackClassName?: string;
  textClassName?: string;
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden",
        className,
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={`${firstName ?? ""} ${lastName ?? ""}`.trim() || "Profile photo"}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={cn(
            "flex h-full w-full items-center justify-center font-semibold",
            fallbackClassName,
            textClassName,
          )}
        >
          {userInitials(firstName, lastName)}
        </span>
      )}
      {children}
    </span>
  );
}
