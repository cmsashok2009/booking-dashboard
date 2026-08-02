import Button from "../../components/ui/Button";
import Checkbox from "../../components/ui/Checkbox";
import Select from "../../components/ui/Select";
import { Summary, WizardPagination } from "./OnboardingUI";

export function OnboardingCampaignSteps({
  step,
  workflow,
  activeTemplates,
  selectedTemplateId,
  busy,
  previewTemplate,
  setEditingTemplate,
  preview,
  onCreateTemplate,
  onClose,
  runAction,
  recipients,
  excluded,
  setExcluded,
  confirmSend,
  setConfirmSend,
  pageRows,
  recordPage,
  setRecordPage
}) {
  return (
    <>
      {" "}
      {step === "template" ? (
        <section>
          <div className="onboarding-section-head">
            <div>
              <h3>Choose an activation template</h3>
              <p>{workflow.summary.created} users were created. Existing and invalid rows are excluded.</p>
            </div>
          </div>
          <Summary summary={workflow.summary} />
          {activeTemplates.length ? (
            <div className="template-selector-panel">
              <div className="field">
                <label htmlFor="activation-template">
                  Activation template{" "}
                  <span className="required-marker" aria-hidden="true">
                    *
                  </span>
                </label>
                <div className="template-select-control">
                  <Select
                    id="activation-template"
                    value={selectedTemplateId}
                    disabled={busy}
                    onChange={(event) => previewTemplate(event.target.value)}
                  >
                    <option value="">Select an activation template</option>
                    {activeTemplates.map((template) => (
                      <option value={template.id} key={template.id}>
                        {template.name} - Version {template.version}
                      </option>
                    ))}
                  </Select>
                  <Button
                    className="template-edit-icon"
                    type="button"
                    disabled={busy || !selectedTemplateId}
                    title="Edit selected template"
                    aria-label="Edit selected activation template"
                    onClick={() =>
                      setEditingTemplate(activeTemplates.find((template) => template.id === selectedTemplateId) || null)
                    }
                  >
                    <span aria-hidden="true">&#9998;</span>
                  </Button>
                </div>
                <span className="field-hint">The selected template will be personalized for every recipient.</span>
              </div>
              {selectedTemplateId ? (
                <div className="selected-template-summary">
                  <div>
                    <span>Selected template</span>
                    <strong>{activeTemplates.find((template) => template.id === selectedTemplateId)?.name}</strong>
                    <small>{activeTemplates.find((template) => template.id === selectedTemplateId)?.subject}</small>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="empty-dependency">
              <span aria-hidden="true">+</span>
              <h3>No active activation template</h3>
              <p>Create one from a supplied sample. Your onboarding progress will remain saved.</p>
              <Button type="button" onClick={() => onCreateTemplate(workflow.id)}>
                Create activation template
              </Button>
            </div>
          )}
          {preview ? (
            <div className="email-preview">
              <div className="email-preview-label">Sample preview - no real activation token</div>
              <strong>{preview.rendered.subject}</strong>
              <pre>{preview.rendered.bodyText}</pre>
            </div>
          ) : null}
          <div className="onboarding-actions">
            <Button variant="secondary" type="button" onClick={onClose}>
              Resume later
            </Button>
            <Button
              type="button"
              disabled={busy || !selectedTemplateId || !preview}
              onClick={() => runAction("template", { templateId: selectedTemplateId })}
            >
              Continue to recipients
            </Button>
          </div>
        </section>
      ) : null}
      {step === "recipients" ? (
        <section>
          <div className="onboarding-section-head">
            <div>
              <h3>Review invitation recipients</h3>
              <p>
                Only newly created, pending users are eligible. Clear a checkbox to exclude a user from this campaign.
              </p>
            </div>
            <span>{recipients.length - excluded.length} selected</span>
          </div>
          <div className="table-wrap recipient-table">
            <table>
              <thead>
                <tr>
                  <th aria-label="Include" />
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Region</th>
                </tr>
              </thead>
              <tbody>
                {pageRows(recipients).map((recipient) => (
                  <tr key={recipient.id}>
                    <td>
                      <Checkbox
                        checked={!excluded.includes(recipient.id)}
                        onChange={(event) =>
                          setExcluded((current) =>
                            event.target.checked
                              ? current.filter((id) => id !== recipient.id)
                              : [...current, recipient.id]
                          )
                        }
                        aria-label={`Include ${recipient.name}`}
                      />
                    </td>
                    <td>{recipient.name}</td>
                    <td>{recipient.email}</td>
                    <td>{recipient.role}</td>
                    <td>{recipient.region || "All"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <WizardPagination page={recordPage} totalRows={recipients.length} onPageChange={setRecordPage} />
          <div className="onboarding-actions onboarding-actions-split">
            <Button variant="secondary" type="button" disabled={busy || confirmSend} onClick={() => runAction("back")}>
              Back to template
            </Button>
            <div>
              <Button variant="secondary" type="button" disabled={busy} onClick={onClose}>
                Resume later
              </Button>
              <Button
                type="button"
                disabled={busy || confirmSend || recipients.length === excluded.length}
                onClick={() => setConfirmSend(true)}
              >{`Send ${recipients.length - excluded.length} activation emails`}</Button>
            </div>
          </div>
        </section>
      ) : null}
      {step === "delivery" || workflow?.campaign ? (
        <section>
          {workflow.campaign?.recipients?.length ? (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows(workflow.campaign.recipients).map((recipient) => (
                      <tr key={recipient.id}>
                        <td>{recipient.name}</td>
                        <td>{recipient.email}</td>
                        <td>
                          <span className={`result-status ${recipient.status === "sent" ? "created" : "failed"}`}>
                            {recipient.status}
                          </span>
                        </td>
                        <td>{recipient.sentAt ? new Date(recipient.sentAt).toLocaleString() : "NA"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <WizardPagination
                page={recordPage}
                totalRows={workflow.campaign.recipients.length}
                onPageChange={setRecordPage}
              />
            </>
          ) : null}
          <div className="onboarding-actions">
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </section>
      ) : null}
    </>
  );
}
