"use client";

import { excelColumns } from "../../constants/dashboard";
import { displayValue, readPath } from "../../utils/bookings";
import { PAGE_SIZE, paged } from "../../utils/pagination";
import Pagination from "../../components/Pagination";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import TextInput from "../../components/ui/TextInput";
import { filterBookingSourceRows } from "./sourceFilters";

export default function BookingSourcePanel({ bookings, filters, page, regions, onFilterChange, onPageChange }) {
  const filteredBookings = filterBookingSourceRows(bookings, filters);
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = paged(filteredBookings, safePage);
  const clearFilters = () => onFilterChange({ search: "", region: "", workflow: "" });

  return (
    <section id="booking-excel-panel" className="panel excel-content-panel" role="tabpanel">
      <div className="section-heading-row">
        <div>
          <h2>Excel Content</h2>
          <p>
            These columns follow the booking Excel sample. Imported fields are readonly; Area Manager and Regional
            Manager updates appear at the end.
          </p>
        </div>
        <small>
          {filteredBookings.length} of {bookings.length} records
        </small>
      </div>
      <div className="table-toolbar excel-table-toolbar">
        <div className="search-control">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <TextInput
            aria-label="Search Excel content"
            value={filters.search}
            onChange={(event) => onFilterChange({ search: event.target.value })}
            placeholder="Search all Excel columns"
          />
        </div>
        <Select
          aria-label="Filter Excel content by region"
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
        <Select
          aria-label="Filter Excel content by workflow"
          value={filters.workflow}
          onChange={(event) => onFilterChange({ workflow: event.target.value })}
        >
          <option value="">All workflow statuses</option>
          <option value="area-updated">Area updated</option>
          <option value="regional-updated">Regional updated</option>
          <option value="pending">Pending workflow</option>
        </Select>
        <Button
          variant="outline"
          type="button"
          onClick={clearFilters}
          disabled={!filters.search && !filters.region && !filters.workflow}
        >
          Clear
        </Button>
      </div>
      <div className="table-wrap">
        <table className="excel-content-table">
          <thead>
            <tr>
              {excelColumns.map(([key, label]) => (
                <th className={key.startsWith("regionalInputs.") ? "excel-wide-input-col" : ""} key={key}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length ? (
              pageRows.map((booking) => (
                <tr key={booking.id}>
                  {excelColumns.map(([key]) => (
                    <td className={key.startsWith("regionalInputs.") ? "excel-wide-input-col" : ""} key={key}>
                      {displayValue(readPath(booking, key))}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty-state" colSpan={excelColumns.length}>
                  No records match the current Excel filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={safePage} totalRows={filteredBookings.length} onPageChange={onPageChange} />
    </section>
  );
}
