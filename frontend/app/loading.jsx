import LoadingState from "./components/ui/LoadingState";

export default function Loading() {
  return (
    <main className="app-state-page">
      <LoadingState
        title="Loading Booking Dashboard"
        description="Retrieving your session and latest booking information."
      />
    </main>
  );
}
