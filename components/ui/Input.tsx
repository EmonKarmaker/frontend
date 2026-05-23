"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, id, className = "", ...rest }, ref) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-fg-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            "h-10 w-full rounded-lg px-3 text-sm bg-surface-2 text-fg",
            "border placeholder:text-fg-subtle",
            "transition-colors duration-100",
            "focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error
              ? "border-danger/60 focus:ring-danger/30 focus:border-danger/60"
              : "border-border",
            className,
          ].join(" ")}
          {...rest}
        />
        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}
      </div>
    );
  }
);
