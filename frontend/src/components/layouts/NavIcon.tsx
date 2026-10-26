import type { ReactNode } from "react";

export function NavIcon({
  to,
  className = "h-[18px] w-[18px]",
}: {
  to: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {iconFor(to)}
    </svg>
  );
}

function iconFor(to: string): ReactNode {
  switch (to) {
    case "/":
      return (
        <>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
          <path d="M9 21v-6h6v6" />
        </>
      );
    case "/customers":
      return (
        <>
          <path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
          <path d="M15 9h3a2 2 0 0 1 2 2v10" />
          <path d="M8 7h3M8 11h3M8 15h3M8 19h3M18 13h.01M18 17h.01" />
          <path d="M3 21h18" />
        </>
      );
    case "/contacts":
      return (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      );
    case "/opportunities":
      return (
        <>
          <path d="M3 4h18l-7 8v6l-4 2v-8L3 4Z" />
          <path d="M8 8h8" />
        </>
      );
    case "/resellers":
      return (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <path d="M10 6.5h4M6.5 10v4M17.5 10v4M10 17.5h4" />
        </>
      );
    case "/tenders":
      return (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
          <path d="M14 2v6h6" />
          <path d="m9 15 2 2 4-4" />
        </>
      );
    case "/sales":
      return (
        <>
          <circle cx="9" cy="20" r="1" />
          <circle cx="19" cy="20" r="1" />
          <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6" />
        </>
      );
    case "/quotes":
      return (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8M8 17h6" />
        </>
      );
    case "/sales-orders":
      return (
        <>
          <path d="M9 5H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="m9 14 2 2 4-4" />
        </>
      );
    case "/invoices":
      return (
        <>
          <path d="M6 2v20l3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2Z" />
          <path d="M9 9h6M9 13h6" />
        </>
      );
    case "/payments":
      return (
        <>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M7 15h2" />
        </>
      );
    case "/products":
      return (
        <>
          <path d="m21 16-9 5-9-5V8l9-5 9 5v8Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </>
      );
    case "/purchasing":
      return (
        <>
          <path d="M1 3h15v13H1z" />
          <path d="M16 8h4l3 3v5h-7V8Z" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </>
      );
    case "/vendors":
      return (
        <>
          <path d="M3 9 5 3h14l2 6" />
          <path d="M4 9v11h16V9" />
          <path d="M9 20v-6h6v6" />
          <path d="M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3" />
        </>
      );
    case "/inventory":
      return (
        <>
          <rect x="3" y="3" width="18" height="5" rx="1" />
          <path d="M5 8v13h14V8" />
          <path d="M10 12h4" />
        </>
      );
    case "/accounting":
      return (
        <>
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M8 6h8" />
          <path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01" />
        </>
      );
    case "/expenses":
      return (
        <>
          <path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v14H5a2 2 0 0 1-2-2V5" />
          <path d="M16 13h.01" />
        </>
      );
    case "/projects":
      return (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 7v10M15 7v5" />
        </>
      );
    case "/tasks":
      return (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="m8 12 3 3 5-6" />
        </>
      );
    case "/renewals":
      return (
        <>
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </>
      );
    case "/reports":
      return (
        <>
          <path d="M3 3v18h18" />
          <path d="M7 16v-5M12 16V8M17 16v-2" />
        </>
      );
    case "/notifications":
      return (
        <>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </>
      );
    case "/users":
      return (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      );
    case "/settings":
      return (
        <>
          <path d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="9" cy="6" r="2" />
          <circle cx="15" cy="12" r="2" />
          <circle cx="8" cy="18" r="2" />
        </>
      );
    default:
      return <circle cx="12" cy="12" r="3" />;
  }
}
