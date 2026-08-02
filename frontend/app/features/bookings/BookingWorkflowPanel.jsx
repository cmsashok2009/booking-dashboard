"use client";

import { detailTitle, displayValue } from "../../utils/bookings";
import { paged } from "../../utils/pagination";
import Button from "../../components/ui/Button";
import IconButton from "../../components/ui/IconButton";
import Pagination from "../../components/Pagination";
import Select from "../../components/ui/Select";
import TextInput from "../../components/ui/TextInput";

export default function BookingWorkflowPanel({
  title = "Bookings",
  detailFilter,
  bookings,
  page,
  search,
  filters,
  regions,
  hideRegionFilter,
  onSearchChange,
  onFilterChange,
  onClear,
  onRefresh,
  onOpenBooking,
  onPageChange
}) {
  const activeTitle = title === "Bookings" ? detailTitle(detailFilter) : title;
  const pageRows = paged(bookings, page);
  const filtersAreEmpty =
    detailFilter === "all" && !search && !filters.region && !filters.wholesaleInput && !filters.retailInput;

  return (
    <section id="booking-workflow-panel" className="panel" role="tabpanel">
      <div className="section-heading-row">
        <div>
          <h2>{activeTitle}</h2>
          <p>Review workflow status and open a booking to see its complete record.</p>
        </div>
        <small>{bookings.length} records</small>
      </div>
      <div className="table-toolbar booking-table-toolbar">
        <div className="search-control">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <TextInput
            aria-label="Search bookings"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search order, dealer or customer"
          />
        </div>
        {!hideRegionFilter ? (
          <Select
            aria-label="Filter bookings by region"
            value={filters.region}
            onChange={(event) => onFilterChange({ region: event.target.value })}
          >
            <option value="">All regions</option>
            {regions.map((region) => (
              <option value={region} key={region}>
                {region}
              </option>
            ))}
          </Select>
        ) : null}
        <Select
          aria-label="Filter bookings by wholesale input"
          value={filters.wholesaleInput}
          onChange={(event) => onFilterChange({ wholesaleInput: event.target.value })}
        >
          <option value="">All wholesale input</option>
          <option value="filled">Wholesale filled</option>
          <option value="missing">Wholesale missing</option>
        </Select>
        <Select
          aria-label="Filter bookings by retail input"
          value={filters.retailInput}
          onChange={(event) => onFilterChange({ retailInput: event.target.value })}
        >
          <option value="">All retail input</option>
          <option value="filled">Retail filled</option>
          <option value="missing">Retail missing</option>
        </Select>
        <Button variant="outline" type="button" onClick={onClear} disabled={filtersAreEmpty}>
          Clear
        </Button>
        <IconButton
          variant="secondary"
          type="button"
          onClick={onRefresh}
          label="Refresh bookings"
          title="Refresh bookings"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
            <path
              d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
      </div>
      <div className="table-wrap">
        <table className="bookings-table">
          <thead>
            <tr>
              <th className="sticky-col sticky-sales">Sales Order</th>
              <th className="sticky-col sticky-dealer">Dealer</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Region</th>
              <th>Model</th>
              <th>Variant</th>
              <th>AVL Status</th>
              <th>Booking Category</th>
              <th>WS Planning</th>
              <th className="wide-input-col">Wholesale Input</th>
              <th className="wide-input-col">Retail Input</th>
              <th className="sticky-action">Action</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length ? (
              pageRows.map((booking) => (
                <tr key={booking.id}>
                  <td className="sticky-col sticky-sales">{displayValue(booking.salesOrderId)}</td>
                  <td className="sticky-col sticky-dealer">{displayValue(booking.dealerCode)}</td>
                  <td>{displayValue(`${booking.contactFirstName || ""} ${booking.contactLastName || ""}`.trim())}</td>
                  <td>{displayValue(booking.phoneNumber)}</td>
                  <td>{displayValue(booking.region)}</td>
                  <td>{displayValue(booking.model)}</td>
                  <td>{displayValue(booking.variant)}</td>
                  <td>
                    <span className="badge warn">{displayValue(booking.avlStatus)}</span>
                  </td>
                  <td>{displayValue(booking.areaInputs?.bookingCategory)}</td>
                  <td>{displayValue(booking.areaInputs?.wsPlanning)}</td>
                  <td className="wide-input-col">{displayValue(booking.regionalInputs?.wholesaleInput)}</td>
                  <td className="wide-input-col">{displayValue(booking.regionalInputs?.retailInput)}</td>
                  <td className="sticky-action">
                    <Button variant="secondary" onClick={() => onOpenBooking(booking)}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="13">No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalRows={bookings.length} onPageChange={onPageChange} />
    </section>
  );
}
