type Size = "sm" | "md" | "lg";

interface LogoProps {
  size?: Size;
  showText?: boolean;
  tagline?: boolean;
}

const config = {
  sm: { iconPx: 38, wordmark: "text-lg",   sub: "text-xs",  gap: "gap-2.5" },
  md: { iconPx: 50, wordmark: "text-2xl",  sub: "text-xs",  gap: "gap-3"   },
  lg: { iconPx: 64, wordmark: "text-3xl",  sub: "text-sm",  gap: "gap-4"   },
};

export function Logo({ size = "md", showText = true, tagline = false }: LogoProps) {
  const { iconPx, wordmark, sub, gap } = config[size];

  return (
    <div className={`inline-flex items-center ${gap}`}>
      {/*
        Icon mark: a house pentagon divided by a vertical center line.
        The split reads as "shared household" — two halves, one home.
        stroke="currentColor" + text-accent → luminous teal.
        drop-shadow filter provides the glow consistent with the design system.
      */}
      <svg
        width={iconPx}
        height={iconPx}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-accent shrink-0"
        style={{ filter: "drop-shadow(0 0 5px rgba(0, 229, 200, 0.55))" }}
        aria-hidden="true"
      >
        {/* House body + roof */}
        <path d="M 4 21 L 4 10 L 12 3.5 L 20 10 L 20 21 Z" />
        {/* Coin inside the house */}
        <circle cx="12" cy="14" r="3.4" />
        {/* Coin center mark */}
        <line x1="12" y1="12.3" x2="12" y2="15.7" />
      </svg>

      {showText && (
        <div className="flex flex-col justify-center leading-tight">
          <span className={`font-display font-bold text-fg tracking-tight ${wordmark}`}>
            HomieGhor
          </span>
          {tagline && (
            <span className={`font-sans text-fg-muted tracking-wide mt-0.5 ${sub}`}>
              Household Expenses
            </span>
          )}
        </div>
      )}
    </div>
  );
}
