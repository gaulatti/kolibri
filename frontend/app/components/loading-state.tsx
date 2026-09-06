import { LoadingSpinner, Skeleton } from "~/bleecker";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="flex min-h-64 flex-col items-center justify-center gap-5 rounded-[var(--radius-card)] border border-sand/20 bg-white/55 px-6 py-16 dark:border-white/[0.07] dark:bg-white/[0.02]"
      role="status"
      aria-live="polite"
    >
      <LoadingSpinner size="md" />
      <div aria-hidden="true" className="w-full max-w-xs space-y-2.5">
        <Skeleton className="mx-auto h-2.5 w-32" />
        <Skeleton className="h-2 w-full opacity-60" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
