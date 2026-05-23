import { Spinner } from "./Spinner";
import { Button } from "./Button";

type Kind = "loading" | "error" | "empty";

interface StatusMessageProps {
  kind: Kind;
  message: string;
  onRetry?: () => void;
}

export function StatusMessage({ kind, message, onRetry }: StatusMessageProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 px-4 text-center">
      {kind === "loading" && <Spinner size="lg" />}
      {kind === "error" && (
        <span className="text-xl text-danger select-none" aria-hidden>⚠</span>
      )}
      {kind === "empty" && (
        <span className="text-xl text-fg-subtle select-none" aria-hidden>○</span>
      )}
      <p className="text-sm text-fg-muted max-w-xs leading-relaxed">{message}</p>
      {kind === "error" && onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
