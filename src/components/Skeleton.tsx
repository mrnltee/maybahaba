export function ResultSkeleton() {
  return (
    <div
      className="w-full rounded-2xl border border-(--color-border) bg-(--color-surface) p-6"
      role="status"
      aria-label="Naglo-load ang resulta"
    >
      <div className="h-5 w-32 animate-pulse-soft rounded-full bg-(--color-paper)" />
      <div className="mt-4 h-8 w-48 animate-pulse-soft rounded-md bg-(--color-paper)" />
      <div className="mt-3 h-4 w-64 animate-pulse-soft rounded-md bg-(--color-paper)" />
      <div className="mt-2 h-4 w-40 animate-pulse-soft rounded-md bg-(--color-paper)" />
      <div className="mt-6 h-10 w-36 animate-pulse-soft rounded-full bg-(--color-paper)" />
    </div>
  );
}
