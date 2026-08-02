"use client";

import ErrorState from "./components/ui/ErrorState";

export default function Error({ reset }) {
  return (
    <main className="app-state-page">
      <ErrorState
        title="This page is temporarily unavailable"
        description="We could not finish loading this page. Your saved information is safe."
        onRetry={reset}
      />
    </main>
  );
}
