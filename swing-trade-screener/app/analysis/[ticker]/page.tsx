import { Suspense } from "react";
import AnalysisPageClient from "./AnalysisPageClient.tsx";

export default function AnalysisPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--background-base)]">
          <p className="font-mono text-sm text-[var(--text-muted)]">Loading analysis...</p>
        </div>
      }
    >
      <AnalysisPageClient params={params} />
    </Suspense>
  );
}
