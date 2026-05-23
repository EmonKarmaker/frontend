type Variant = "default" | "positive" | "negative" | "emphasis";
type Size = "sm" | "md" | "lg" | "xl";

interface MoneyProps {
  amount: number | string;
  variant?: Variant;
  size?: Size;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  default:  "text-fg",
  positive: "text-success",
  negative: "text-danger",
  emphasis: "text-accent text-glow",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-3xl",
};

function groupDigits(s: string): string {
  return s.replace(/\B(?=(\d{3})+$)/g, ",");
}

export function Money({ amount, variant = "default", size = "md", className = "" }: MoneyProps) {
  let formatted: string;
  let negative: boolean;

  if (typeof amount === "string") {
    const trimmed = amount.trim();
    negative = trimmed.startsWith("-");
    const absStr = negative ? trimmed.slice(1) : trimmed;
    const [intStr = "0", fracStr = ""] = absStr.split(".");

    // Convert to thousandths (3 dp) so the 3rd digit drives half-up rounding.
    // Pad/truncate fracStr to exactly 3 digits — digits beyond the 3rd don't
    // affect half-up rounding to 2 dp.
    const fracThree = (fracStr + "000").slice(0, 3);
    const thousandths = BigInt(intStr) * 1000n + BigInt(fracThree);

    // Half-up round to cents: (n + 5) / 10 in BigInt (truncates toward zero,
    // which for a positive value is the same as floor — correct here because
    // we always operate on the absolute value).
    const cents = (thousandths + 5n) / 10n;

    const intPart = cents / 100n;
    const fracPart = cents % 100n;
    formatted = `${groupDigits(intPart.toString())}.${fracPart.toString().padStart(2, "0")}`;
  } else {
    negative = amount < 0;
    const abs = Math.abs(amount);
    formatted = abs.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return (
    <span
      className={[
        "font-display tabular-nums tracking-tight",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(" ")}
    >
      {negative ? "−" : ""}৳{formatted}
    </span>
  );
}
