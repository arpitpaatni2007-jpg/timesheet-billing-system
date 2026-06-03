// ── ui/Button.jsx ─────────────────────────────────────────────────────────────
// Multi-variant button with built-in loading state.
// Variants: "primary" (amber/gold), "secondary" (subtle outline), "ghost" (no border)
// Props:
//   variant   — "primary" | "secondary" | "ghost"
//   loading   — shows Spinner, disables click
//   disabled  — disabled state
//   leftIcon  — Lucide icon component rendered before text
//   fullWidth — stretches to container width

import React from "react";
import Spinner from "./Spinner";

const styles = {
  base: {
    display:        "inline-flex",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "8px",
    fontFamily:     "var(--font-ui)",
    fontSize:       "14px",
    fontWeight:     "500",
    letterSpacing:  "0.01em",
    borderRadius:   "var(--radius-sm)",
    border:         "1px solid transparent",
    cursor:         "pointer",
    transition:     "all 0.15s ease",
    padding:        "9px 18px",
    whiteSpace:     "nowrap",
    outline:        "none",
  },
  primary: {
    background:   "var(--accent)",
    color:        "#0f1015",         // Dark text on amber background
    borderColor:  "var(--accent)",
  },
  primaryHover: {
    background:  "#d49200",
    borderColor: "#d49200",
  },
  secondary: {
    background:  "transparent",
    color:       "var(--text-primary)",
    borderColor: "var(--border-default)",
  },
  secondaryHover: {
    background:  "var(--bg-hover)",
    borderColor: "var(--border-strong)",
  },
  ghost: {
    background:  "transparent",
    color:       "var(--text-secondary)",
    borderColor: "transparent",
  },
  ghostHover: {
    color:       "var(--text-primary)",
    background:  "var(--bg-elevated)",
  },
  disabled: {
    opacity:  "0.45",
    cursor:   "not-allowed",
    pointerEvents: "none",
  },
};

const Button = ({
  children,
  variant = "primary",
  loading = false,
  disabled = false,
  leftIcon: Icon = null,
  fullWidth = false,
  onClick,
  type = "button",
  style: extraStyle = {},
  ...rest
}) => {
  const [hovered, setHovered] = React.useState(false);
  const isDisabled = disabled || loading;

  // Build the style object based on variant + state
  const variantStyle = {
    ...styles.base,
    ...styles[variant],
    ...(hovered && !isDisabled ? styles[`${variant}Hover`] : {}),
    ...(isDisabled ? styles.disabled : {}),
    ...(fullWidth ? { width: "100%" } : {}),
    ...extraStyle,
  };

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      style={variantStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...rest}
    >
      {/* Show spinner OR the left icon — not both */}
      {loading ? (
        <Spinner
          size="sm"
          color={variant === "primary" ? "#0f1015" : "var(--text-secondary)"}
        />
      ) : (
        Icon && <Icon size={15} strokeWidth={2} />
      )}

      {children}
    </button>
  );
};

export default Button;
