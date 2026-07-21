const icons = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />

      <rect x="14" y="3" width="7" height="7" rx="2" />

      <rect x="3" y="14" width="7" height="7" rx="2" />

      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),

  tickets: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v3a2.5 2.5 0 0 0 0 5v3A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-3a2.5 2.5 0 0 0 0-5Z" />

      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),

  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),

  activity: (
    <>
      <path d="M3 12h4l2.5-7 5 14 2.5-7H21" />
    </>
  ),

  logs: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />

      <path d="M8 8h8" />

      <path d="M8 12h8" />

      <path d="M8 16h5" />
    </>
  ),

  open: (
    <>
      <circle cx="12" cy="12" r="9" />

      <path d="M12 7v5l3 2" />
    </>
  ),

  check: (
    <>
      <circle cx="12" cy="12" r="9" />

      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),

  archive: (
    <>
      <path d="M4 7h16v12H4zM3 4h18v3H3z" />

      <path d="M9 11h6" />
    </>
  ),

  sparkles: (
    <>
      <path d="m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2Z" />

      <path d="m18 13 .8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8Z" />

      <path d="m6 14 .7 1.8 1.8.7-1.8.7L6 19l-.7-1.8-1.8-.7 1.8-.7Z" />
    </>
  ),

  confidence: (
    <>
      <path d="M4 19V9M10 19V5M16 19v-7M22 19V3" />
    </>
  ),

  search: (
    <>
      <circle cx="11" cy="11" r="7" />

      <path d="m20 20-4-4" />
    </>
  ),

  arrowRight: <path d="M5 12h14m-5-5 5 5-5 5" />,

  chevronRight: <path d="m9 18 6-6-6-6" />,

  user: (
    <>
      <circle cx="12" cy="8" r="4" />

      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),

  logout: (
    <>
      <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />

      <path d="M14 8l4 4-4 4" />

      <path d="M18 12H9" />
    </>
  ),

  menu: (
    <>
      <path d="M4 7h16" />

      <path d="M4 12h16" />

      <path d="M4 17h16" />
    </>
  ),

  close: (
    <>
      <path d="m6 6 12 12" />

      <path d="m18 6-12 12" />
    </>
  ),
};

function Icon({ name, size = 20, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name] || icons.activity}
    </svg>
  );
}

export default Icon;
