interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-7",
};

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`${sizes[size]} inline-block rounded-full spinner-ring animate-spin-smooth ${className}`}
    />
  );
}
