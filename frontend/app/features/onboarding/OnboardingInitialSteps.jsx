import Button from "../../components/ui/Button";
import FileInput from "../../components/ui/FileInput";
import { OUTCOME_LABELS, Summary, WizardPagination } from "./OnboardingUI";

export function OnboardingInitialSteps({
  step,
  error,
  workflow,
  fileName,
  setFileName,
  setError,
  validateUpload,
  busy,
  pageRows,
  recordPage,
  setRecordPage,
  onClose,
  runAction,
  closeBatch
}) {
  return (
    <>
      {" "}
      {error ? (
        <div className="onboarding-alert error" role="alert">
          <strong>Unable to continue</strong>
          <p>{error}</p>
        </div>
      ) : null}
      {!workflow ? (
        <section className="onboarding-upload-step">
          <div className="onboarding-intro">
            <h3>Upload the approved user template</h3>
            <p>Existing users are skipped. Valid new users continue even when another row needs correction.</p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              if (!data.get("userFile")?.name) return setError("Choose an Excel or CSV file.");
              validateUpload(data);
            }}
          >
            <label className="user-file-drop">
              <span className="booking-file-icon" aria-hidden="true">
                &#8593;
              </span>
              <span>
                <strong>{fileName || "Choose an Excel or CSV file"}</strong>
                <small>XLSX or CSV, up to 5 MB and 500 rows</small>
              </span>
              <span className="button-link">Browse</span>
              <FileInput
                className="visually-hidden"
                name="userFile"
                accept=".xlsx,.csv"
                onChange={(event) => {
                  setFileName(event.target.files?.[0]?.name || "");
                  setError("");
                }}
              />
            </label>
            <div className="onboarding-help">
              <strong>Required:</strong> Name, Email, Role, Status. Role and reporting hierarchy are checked against the
              database.
            </div>
            <div className="onboarding-actions">
              <a className="button-link secondary-link" href="/api/ui/users/template">
                Download template
              </a>
              <Button type="submit" disabled={busy}>
                {busy ? "Validating..." : "Validate users"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}
      {step === "validation" ? (
        <section>
          <div className="onboarding-section-head">
            <div>
              <h3>Validation results</h3>
              <p>Review every outcome before creating valid users.</p>
            </div>
          </div>
          <Summary summary={workflow.summary} />
          <div className="table-wrap onboarding-results-table">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Outcome</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {pageRows(workflow.rows).map((row) => (
                  <tr key={row.id}>
                    <td>{row.rowNumber}</td>
                    <td>
                      <strong>{row.name || "NA"}</strong>
                      <small>{row.email || "NA"}</small>
                    </td>
                    <td>{row.role || "NA"}</td>
                    <td>
                      <span className={`result-status ${row.outcome}`}>
                        {OUTCOME_LABELS[row.outcome] || row.outcome}
                      </span>
                    </td>
                    <td>{row.errors?.map((item) => item.errorMessage).join("; ") || "Ready to create"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <WizardPagination page={recordPage} totalRows={workflow.rows.length} onPageChange={setRecordPage} />
          {workflow.summary.ready ? (
            <div className="onboarding-actions">
              <Button variant="secondary" type="button" onClick={onClose}>
                Resume later
              </Button>
              <Button type="button" disabled={busy} onClick={() => runAction("import")}>
                {busy ? "Creating users..." : `Create ${workflow.summary.ready} valid users`}
              </Button>
            </div>
          ) : (
            <>
              <div className="onboarding-zero-result">
                <strong>No new users to create</strong>
                <p>
                  Every row already exists or needs correction. Close this batch to remove it from Onboarding in
                  progress; its validation history will remain available for audit.
                </p>
              </div>
              <div className="onboarding-actions">
                <Button variant="secondary" type="button" onClick={onClose}>
                  Keep for later
                </Button>
                <Button type="button" disabled={busy} onClick={closeBatch}>
                  {busy ? "Closing batch..." : "Close batch"}
                </Button>
              </div>
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
