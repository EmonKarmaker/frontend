"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

const base = [
  "inline-flex items-center justify-center gap-2 font-medium rounded-lg",
  "transition-all duration-150 cursor-pointer",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
  "disabled:pointer-events-none disabled:opacity-50",
].join(" ");

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-bg hover:brightness-110 glow-sm",
  secondary:
    "bg-surface-2 text-fg border border-border hover:bg-surface-3",
  ghost:
    "text-fg-muted hover:text-fg hover:bg-surface-2",
  danger:
    "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
