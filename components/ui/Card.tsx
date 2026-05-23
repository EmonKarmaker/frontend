import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  title?: string;
  header?: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({ children, title, header, className = "", noPadding }: CardProps) {
  const hasHead = title || header;

  return (
    <div
      className={`rounded-xl bg-surface-1 border border-border ${className}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {hasHead && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          {title && (
            <h2 className="font-display text-sm font-semibold text-fg tracking-tight">
              {title}
            </h2>
          )}
          {header}
        </div>
      )}
      <div className={noPadding ? "" : "px-5 py-4"}>{children}</div>
    </div>
  );
}
