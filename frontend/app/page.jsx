import BookingDashboard from "./booking-dashboard";
import AppErrorBoundary from "./components/AppErrorBoundary";
import GlobalApiActivity from "./components/GlobalApiActivity";

export default function Page() {
  return (
    <AppErrorBoundary>
      <GlobalApiActivity />
      <BookingDashboard />
    </AppErrorBoundary>
  );
}
