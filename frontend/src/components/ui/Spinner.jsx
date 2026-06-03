// ── ui/Spinner.jsx ────────────────────────────────────────────────────────────
// Simple animated spinner. Used inside buttons and loading states.
// Props:
//   size — "sm" (14px) | "md" (18px, default) | "lg" (24px)
//   color — CSS color string (defaults to currentColor — inherits from parent)

import React from "react";

const sizes = { sm: 14, md: 18, lg: 24 };

const Spinner = ({ size = "md", color = "currentColor", style = {} }) => {
  const px = sizes[size] || sizes.md;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      style={{
        animation: "spin 0.75s linear infinite", // Defined in globals.css
        flexShrink: 0,
        ...style,
      }}
      aria-label="Loading"
      role="status"
    >
      {/* Background track */}
      <circle
        cx="12" cy="12" r="10"
        stroke={color}
        strokeWidth="2.5"
        opacity="0.2"
      />
      {/* Spinning arc — only top quarter visible */}
      <path
        d="M12 2 A10 10 0 0 1 22 12"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default Spinner;
