"use client";

import { displayValue } from "../../utils/bookings";
import Button from "../../components/ui/Button";
import CloseButton from "../../components/ui/CloseButton";
import Select from "../../components/ui/Select";
import SideDrawer from "../../components/ui/SideDrawer";
import TextArea from "../../components/ui/TextArea";
import TextInput from "../../components/ui/TextInput";
import { canViewAreaInputs, canViewRegionalInputs } from "./rolePolicy";

function ReadonlyValues({ fields, className = "" }) {
  return (
    <dl className={`booking-definition-grid ${className}`.trim()}>
      {fields.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{displayValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function LookupSelect({ id, name, values = [], current, disabled }) {
  return (
    <Select id={id} name={name} defaultValue={current || ""} disabled={disabled}>
      <option value="">Select</option>
      {values.map((value) => (
        <option key={value}>{value}</option>
      ))}
    </Select>
  );
}

export default function BookingDetailsDrawer({
  booking,
  lookups = {},
  role,
  canEditArea,
  canEditRegional,
  onClose,
  onSaveArea,
  onSaveRegional
}) {
  if (!booking) return null;

  const bookingFieldGroups = [
    {
      title: "Customer",
      fields: [
        ["Dealer Code", booking.dealerCode],
        ["First Name", booking.contactFirstName],
        ["Last Name", booking.contactLastName],
        ["Phone Number", booking.phoneNumber]
      ]
    },
    {
      title: "Booking",
      fields: [
        ["Sales Order ID", booking.salesOrderId],
        ["Creation Date", booking.creationDate],
        ["Category", booking.category],
        ["Model", booking.model],
        ["Variant", booking.variant]
      ]
    },
    {
      title: "Assignment",
      fields: [
        ["Dealer Group", booking.dealerGroup],
        ["Area Manager", booking.amNameFromFile],
        ["Region", booking.region]
      ]
    },
    {
      title: "Supply and Reconciliation",
      fields: [
        ["Mapped Color", booking.colorMapped],
        ["CAT", booking.cat],
        ["VIN Year", booking.vinYear],
        ["Matched Status", booking.matchedStatus],
        ["Availability Status", booking.avlStatus],
        ["RPOS Order Status", booking.rposOrderStatus],
        ["RPASS Booking", booking.rpassBkg],
        ["Combined Reconciliation", booking.comb1]
      ]
    }
  ];

  return (
    <SideDrawer
      className="booking-detail-modal"
      backdropClassName="booking-detail-backdrop"
      labelledBy="booking-detail-title"
      onClose={onClose}
    >
      <div className="modal-header booking-detail-header">
        <div>
          <span className="modal-eyebrow">Booking record</span>
          <h2 id="booking-detail-title">Booking Details</h2>
          <p>Review booking information and role-specific updates.</p>
          <div className="booking-detail-meta">
            <span>{displayValue(booking.salesOrderId)}</span>
            <span>{displayValue(booking.model)}</span>
            <span>{displayValue(booking.region)}</span>
          </div>
        </div>
        <CloseButton
          className="modal-close-button"
          onClick={onClose}
          label="Close booking details"
          title="Close"
          autoFocus
        />
      </div>
      <div className="booking-detail-body" role="region" aria-label="Booking details content" tabIndex={0}>
        <section className="booking-fields-section" aria-labelledby="booking-fields-title">
          <div className="booking-section-heading">
            <h2 id="booking-fields-title">Booking Information</h2>
            <span>Imported fields are readonly</span>
          </div>
          <div className="booking-field-groups">
            {bookingFieldGroups.map((group) => (
              <section className="booking-field-group" key={group.title}>
                <h3>{group.title}</h3>
                <ReadonlyValues fields={group.fields} />
              </section>
            ))}
          </div>
        </section>
        <div className="workflow-stack">
          {canViewAreaInputs(role) ? (
            <section className="panel">
              <h2>Area Manager Inputs</h2>
              {canEditArea ? (
                <form className="area-input-grid" onSubmit={onSaveArea}>
                  <div className="field">
                    <label htmlFor="booking-category">Booking Category</label>
                    <LookupSelect
                      id="booking-category"
                      name="bookingCategory"
                      values={lookups.bookingCategory}
                      current={booking.areaInputs?.bookingCategory}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="wholesales-feedback">Wholesales Feedback</label>
                    <LookupSelect
                      id="wholesales-feedback"
                      name="wholesalesFeedback"
                      values={lookups.wholesalesFeedback}
                      current={booking.areaInputs?.wholesalesFeedback}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="ws-planning">WS Planning</label>
                    <LookupSelect
                      id="ws-planning"
                      name="wsPlanning"
                      values={lookups.wsPlanning}
                      current={booking.areaInputs?.wsPlanning}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="expected-retail-date">Expected Retail Date</label>
                    <TextInput
                      id="expected-retail-date"
                      name="expectedRetailDate"
                      type="date"
                      defaultValue={booking.areaInputs?.expectedRetailDate || ""}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="cancellation-reason">Remarks for Cancellation / Not Yet Decided</label>
                    <LookupSelect
                      id="cancellation-reason"
                      name="cancellationReason"
                      values={lookups.cancellationReason}
                      current={booking.areaInputs?.cancellationReason}
                    />
                  </div>
                  <Button type="submit">Save Area Inputs</Button>
                </form>
              ) : (
                <ReadonlyValues
                  fields={[
                    ["Booking Category", booking.areaInputs?.bookingCategory],
                    ["Wholesales Feedback", booking.areaInputs?.wholesalesFeedback],
                    ["WS Planning", booking.areaInputs?.wsPlanning],
                    ["Expected Retail Date", booking.areaInputs?.expectedRetailDate],
                    ["Remarks for Cancellation / Not Yet Decided", booking.areaInputs?.cancellationReason]
                  ]}
                />
              )}
            </section>
          ) : null}
          {canViewRegionalInputs(role) ? (
            <section className="panel">
              <h2>Regional Manager Inputs</h2>
              {canEditRegional ? (
                <form className="grid" onSubmit={onSaveRegional}>
                  <div className="field">
                    <label htmlFor="wholesale-input">Wholesale Input</label>
                    <TextArea
                      id="wholesale-input"
                      name="wholesaleInput"
                      maxLength="2000"
                      defaultValue={booking.regionalInputs?.wholesaleInput || ""}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="retail-input">Retail Input</label>
                    <TextArea
                      id="retail-input"
                      name="retailInput"
                      maxLength="2000"
                      defaultValue={booking.regionalInputs?.retailInput || ""}
                    />
                  </div>
                  <Button type="submit">Save Regional Inputs</Button>
                </form>
              ) : (
                <ReadonlyValues
                  fields={[
                    ["Wholesale Input", booking.regionalInputs?.wholesaleInput],
                    ["Retail Input", booking.regionalInputs?.retailInput]
                  ]}
                  className="regional-readonly-grid"
                />
              )}
            </section>
          ) : null}
        </div>
      </div>
    </SideDrawer>
  );
}
