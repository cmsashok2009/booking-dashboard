import { displayValue } from "../utils/bookings";
import Button from "./ui/Button";

export default function ReconciliationExceptions({ rows, onOpenBooking, viewerRole, Heading }) {
  if (!rows.length) {
    return (
      <section className="recon-status-banner recon-status-clear">
        <span className="recon-status-icon" aria-hidden="true">
          &#10003;
        </span>
        <div>
          <Heading
            title="No critical exceptions"
            tooltip="No booking in the current scope is both at least 14 days old and missing confirmed stock, a VIN, or an available order."
          />
          <p>No bookings are both 14+ days old and missing a confirmed supply path.</p>
        </div>
      </section>
    );
  }

  const actionableViewer = ["Area Manager", "Regional Manager"].includes(viewerRole);
  const ownerFor = (booking) => {
    const areaComplete = Boolean(booking.areaInputs?.updatedAt);
    return areaComplete
      ? { role: "Regional Manager", label: `Regional Manager - ${displayValue(booking.region)}` }
      : { role: "Area Manager", label: displayValue(booking.amNameFromFile) };
  };

  return (
    <section className="recon-card exception-card">
      <div className="recon-card-head exception-card-head">
        <div>
          <Heading
            title="Supply exceptions"
            tooltip="Bookings aged 14 days or more with no confirmed stock, VIN, or available order, together with the role responsible for follow-up."
          />
          <p>
            Bookings aged 14+ days without confirmed stock, VIN, or an available order. Workflow action remains with the
            assigned Area or Regional Manager.
          </p>
        </div>
        <span className="exception-count">
          {rows.length} {actionableViewer ? "require follow-up" : "monitored exceptions"}
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sales Order</th>
              <th>Dealer</th>
              <th>Area</th>
              <th>Model</th>
              <th>Aging</th>
              <th>Availability</th>
              <th>Action owner</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((booking) => {
              const owner = ownerFor(booking);
              const ownedByViewer = viewerRole === owner.role;
              return (
                <tr key={booking.id}>
                  <td>{displayValue(booking.salesOrderId)}</td>
                  <td>{displayValue(booking.dealerCode)}</td>
                  <td>{displayValue(booking.amNameFromFile)}</td>
                  <td>{displayValue(booking.model)}</td>
                  <td>
                    <strong className="aging-alert">{displayValue(booking.agingBookings)} days</strong>
                  </td>
                  <td>{displayValue(booking.avlStatus)}</td>
                  <td>
                    <span className={`exception-owner${ownedByViewer ? " is-current-role" : ""}`}>
                      {owner.label}
                      {ownedByViewer ? " (your role)" : ""}
                    </span>
                  </td>
                  <td>
                    <Button variant="secondary" size="sm" onClick={() => onOpenBooking(booking)}>
                      {actionableViewer ? "Review booking" : "View booking"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
