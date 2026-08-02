"use client";

import ErrorState from "./components/ui/ErrorState";

export default function GlobalError({ reset }) {
  return (
    <html lang="en">
      <body>
        <main className="app-state-page">
          <ErrorState
            title="Booking Dashboard could not start"
            description="A temporary application error prevented startup. Please retry."
            onRetry={reset}
          />
        </main>
      </body>
    </html>
  );
}
