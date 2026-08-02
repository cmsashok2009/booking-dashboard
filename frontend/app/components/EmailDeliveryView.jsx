"use client";

import { useMemo, useState } from "react";
import Pagination from "./Pagination";
import { EmptyState, PageHeader, Select, StatusBadge, Table, TextInput } from "./ui";
const DELIVERY_PAGE_SIZE = 5;

function campaignVariant(campaign) {
  if (campaign.failed) return "danger";
  return campaign.status === "completed" ? "success" : "warning";
}

function deliveryRate(campaign) {
  if (!campaign.total) return 0;
  return Math.round(((campaign.sent || 0) / campaign.total) * 100);
}

export default function EmailDeliveryView({ campaigns = [] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const totalSent = campaigns.reduce((sum, campaign) => sum + (campaign.sent || 0), 0);
  const totalFailed = campaigns.reduce((sum, campaign) => sum + (campaign.failed || 0), 0);

  const filteredCampaigns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...campaigns]
      .filter((campaign) => {
        if (status === "successful" && campaign.failed) return false;
        if (status === "failed" && !campaign.failed) return false;
        if (!normalizedQuery) return true;

        return campaign.recipients?.some((recipient) =>
          [recipient.name, recipient.email, recipient.provider]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(normalizedQuery))
        );
      })
      .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
  }, [campaigns, query, status]);

  const currentPage = Math.min(page, Math.max(1, Math.ceil(filteredCampaigns.length / DELIVERY_PAGE_SIZE)));
  const visibleCampaigns = filteredCampaigns.slice(
    (currentPage - 1) * DELIVERY_PAGE_SIZE,
    currentPage * DELIVERY_PAGE_SIZE
  );

  function updateQuery(event) {
    setQuery(event.target.value);
    setPage(1);
  }

  function updateStatus(event) {
    setStatus(event.target.value);
    setPage(1);
  }

  return (
    <div className="delivery-management">
      <div className="delivery-metrics" aria-label="Delivery summary">
        <div>
          <span>Campaigns</span>
          <strong>{campaigns.length}</strong>
        </div>
        <div>
          <span>Emails sent</span>
          <strong>{totalSent}</strong>
        </div>
        <div className={totalFailed ? "has-failures" : ""}>
          <span>Failed</span>
          <strong>{totalFailed}</strong>
        </div>
      </div>
      <section className="email-content-section delivery-log-panel">
        <PageHeader
          title="Invitation Delivery Log"
          subtitle="Campaign and recipient outcomes from the configured email provider."
        />
        {campaigns.length ? (
          <>
            <div className="delivery-toolbar">
              <label className="delivery-search">
                <span className="visually-hidden">Search recipients</span>
                <TextInput type="search" value={query} onChange={updateQuery} placeholder="Search recipient or email" />
              </label>
              <label className="delivery-filter">
                <span>Status</span>
                <Select value={status} onChange={updateStatus}>
                  <option value="all">All campaigns</option>
                  <option value="successful">Successful</option>
                  <option value="failed">With failures</option>
                </Select>
              </label>
              <span className="delivery-result-count" aria-live="polite">
                {filteredCampaigns.length} {filteredCampaigns.length === 1 ? "campaign" : "campaigns"}
              </span>
            </div>

            {visibleCampaigns.length ? (
              <div className="campaign-table">
                <div className="campaign-table-head" aria-hidden="true">
                  <span>Campaign</span>
                  <span>Sent</span>
                  <span>Failures</span>
                  <span>Status</span>
                  <span />
                </div>
                {visibleCampaigns.map((campaign) => (
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
                      <Table>
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

            {filteredCampaigns.length > DELIVERY_PAGE_SIZE ? (
              <Pagination
                page={currentPage}
                pageSize={DELIVERY_PAGE_SIZE}
                totalRows={filteredCampaigns.length}
                onPageChange={setPage}
              />
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
