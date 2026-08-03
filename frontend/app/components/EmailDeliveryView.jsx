"use client";

import "../styles/13-email-delivery.css";

import Pagination from "./Pagination";
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, Select, StatusBadge, Table, TextInput } from "./ui";

function campaignVariant(campaign) {
  if (campaign.failed) return "danger";
  return campaign.status === "completed" ? "success" : "warning";
}

function deliveryRate(campaign) {
  if (!campaign.total) return 0;
  return Math.round(((campaign.sent || 0) / campaign.total) * 100);
}

export default function EmailDeliveryView({
  campaigns = [],
  pagination = { total: 0 },
  summary = { campaigns: 0, sent: 0, failed: 0 },
  filters = { search: "", status: "all" },
  page = 1,
  loading = false,
  error = "",
  setPage,
  updateFilters,
  reload
}) {
  function updateQuery(event) {
    updateFilters({ search: event.target.value });
  }

  function updateStatus(event) {
    updateFilters({ status: event.target.value });
  }
  return (
    <div className="delivery-management">
      <div className="delivery-metrics" aria-label="Delivery summary">
        <div>
          <span>Campaigns</span>
          <strong>{summary.campaigns}</strong>
        </div>
        <div>
          <span>Emails sent</span>
          <strong>{summary.sent}</strong>
        </div>
        <div className={summary.failed ? "has-failures" : ""}>
          <span>Failed</span>
          <strong>{summary.failed}</strong>
        </div>
      </div>
      <section className="email-content-section delivery-log-panel" aria-busy={loading}>
        <PageHeader
          title="Invitation Delivery Log"
          subtitle="Campaign and recipient outcomes from the configured email provider."
        />
        {loading && !campaigns.length ? (
          <LoadingState title="Loading delivery campaigns" description="Retrieving the latest provider outcomes." />
        ) : error && !campaigns.length ? (
          <ErrorState title="Delivery campaigns unavailable" description={error} onRetry={reload} showHome={false} />
        ) : summary.campaigns ? (
          <>
            <div className="delivery-toolbar">
              <label className="delivery-search">
                <span className="visually-hidden">Search recipients</span>
                <TextInput
                  type="search"
                  value={filters.search}
                  onChange={updateQuery}
                  placeholder="Search recipient or email"
                />
              </label>
              <label className="delivery-filter">
                <span>Status</span>
                <Select value={filters.status} onChange={updateStatus}>
                  <option value="all">All campaigns</option>
                  <option value="successful">Successful</option>
                  <option value="failed">With failures</option>
                </Select>
              </label>
              <span className="delivery-result-count" aria-live="polite">
                {pagination.total} {pagination.total === 1 ? "campaign" : "campaigns"}
              </span>
            </div>

            {error ? (
              <div className="inline-status error" role="alert">
                <span>{error} Existing results remain visible.</span>
                <Button type="button" variant="secondary" onClick={reload}>
                  Retry
                </Button>
              </div>
            ) : null}
            {loading ? (
              <span className="visually-hidden" aria-live="polite">
                Refreshing delivery campaigns
              </span>
            ) : null}

            {campaigns.length ? (
              <div className="campaign-table">
                <div className="campaign-table-head" aria-hidden="true">
                  <span>Campaign</span>
                  <span>Sent</span>
                  <span>Failures</span>
                  <span>Status</span>
                  <span />
                </div>
                {campaigns.map((campaign) => (
                  <details className="campaign-log" key={campaign.id}>
                    <summary>
                      <div className="campaign-identity">
                        <strong>Activation campaign</strong>
                        <span>{new Date(campaign.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="campaign-delivery">
                        <strong>
                          {campaign.sent || 0} of {campaign.total || 0}
                        </strong>
                        <span className="delivery-progress" aria-label={`${deliveryRate(campaign)} percent sent`}>
                          <span style={{ width: `${deliveryRate(campaign)}%` }} />
                        </span>
                      </div>
                      <strong className={campaign.failed ? "failure-count has-failures" : "failure-count"}>
                        {campaign.failed || 0}
                      </strong>
                      <StatusBadge variant={campaignVariant(campaign)}>{campaign.status}</StatusBadge>
                      <span className="campaign-expand" aria-hidden="true" />
                    </summary>
                    <div className="campaign-recipients">
                      <Table aria-label="Campaign recipient delivery outcomes">
                        <thead>
                          <tr>
                            <th>Recipient</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Provider</th>
                            <th>Sent</th>
                            <th>Failure reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(campaign.recipients || []).map((recipient) => (
                            <tr key={recipient.id}>
                              <td>{recipient.name}</td>
                              <td>{recipient.email}</td>
                              <td>
                                <span className={`result-status ${recipient.status === "sent" ? "created" : "failed"}`}>
                                  {recipient.status}
                                </span>
                              </td>
                              <td>{recipient.provider || "NA"}</td>
                              <td>{recipient.sentAt ? new Date(recipient.sentAt).toLocaleString() : "NA"}</td>
                              <td>{recipient.failureReason || "NA"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No matching campaigns"
                description="Try a different recipient, email, or status filter."
              />
            )}

            {pagination.total > 5 ? (
              <Pagination page={page} pageSize={5} totalRows={pagination.total} onPageChange={setPage} />
            ) : null}
          </>
        ) : (
          <EmptyState
            title="No invitation campaigns yet"
            description="Campaign delivery results will appear after an Admin sends activation emails."
          />
        )}
      </section>
    </div>
  );
}
