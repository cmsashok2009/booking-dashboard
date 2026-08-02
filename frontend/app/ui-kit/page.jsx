"use client";

import { useState } from "react";
import Button from "../components/ui/Button";
import Checkbox from "../components/ui/Checkbox";
import CloseButton from "../components/ui/CloseButton";
import DataTable from "../components/ui/DataTable";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import Field from "../components/ui/Field";
import FileInput from "../components/ui/FileInput";
import FilterToolbar from "../components/ui/FilterToolbar";
import IconButton from "../components/ui/IconButton";
import LinkButton from "../components/ui/LinkButton";
import LoadingState from "../components/ui/LoadingState";
import MetricCard from "../components/ui/MetricCard";
import ModalShell from "../components/ui/ModalShell";
import NavigationItem from "../components/ui/NavigationItem";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";
import Select from "../components/ui/Select";
import SideDrawer from "../components/ui/SideDrawer";
import StatusBadge from "../components/ui/StatusBadge";
import { Tab, TabList } from "../components/ui/Tabs";
import TextArea from "../components/ui/TextArea";
import TextInput from "../components/ui/TextInput";

export default function UiKitPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <main className="activation-page ui-kit-page">
      <section className="activation-shell ui-kit-shell">
        <header className="ui-kit-header">
          <h1>UI Kit</h1>
          <p>Reusable Booking Dashboard controls and interaction states.</p>
        </header>

        <Panel>
          <h2 className="ui-kit-section-title">Buttons and commands</h2>
          <div className="ui-kit-control-grid">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="dangerQuiet">Quiet danger</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
            <Button busy busyLabel="Saving...">
              Loading
            </Button>
            <Button leadingIcon="+">Add item</Button>
            <IconButton label="Help">?</IconButton>
          </div>
        </Panel>

        <Panel>
          <h2 className="ui-kit-section-title">Form controls</h2>
          <div className="form-grid ui-kit-form-grid">
            <Field label="Email" htmlFor="ui-email" required hint="Standard text input">
              <TextInput id="ui-email" type="email" placeholder="name@example.com" />
            </Field>
            <Field label="Status" htmlFor="ui-status">
              <Select id="ui-status" defaultValue="active">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="locked">Locked</option>
              </Select>
            </Field>
            <Field label="Invalid value" htmlFor="ui-invalid" error="Enter a valid dealer code.">
              <TextInput id="ui-invalid" defaultValue="?" aria-invalid="true" aria-describedby="ui-invalid-error" />
            </Field>
            <Field label="Disabled value" htmlFor="ui-disabled">
              <TextInput id="ui-disabled" value="Read only" disabled readOnly />
            </Field>
            <Field label="Notes" htmlFor="ui-notes" required>
              <TextArea id="ui-notes" rows="4" placeholder="Write something..." />
            </Field>
            <Field label="Attachment" htmlFor="ui-file" hint="CSV or XLSX">
              <FileInput id="ui-file" accept=".csv,.xlsx" />
            </Field>
            <Checkbox label="Send a notification" hint="Checked state" defaultChecked />
            <Checkbox label="Unavailable option" disabled />
          </div>
        </Panel>

        <Panel>
          <h2 className="ui-kit-section-title">Navigation, tabs, and filters</h2>
          <nav className="ui-kit-navigation" aria-label="UI Kit navigation example">
            <NavigationItem active>Overview</NavigationItem>
            <NavigationItem>Bookings</NavigationItem>
            <NavigationItem disabled>Unavailable</NavigationItem>
          </nav>
          <TabList label="UI Kit views">
            <Tab selected={activeTab === "overview"} controls="ui-tab-panel" onClick={() => setActiveTab("overview")}>
              Overview
            </Tab>
            <Tab selected={activeTab === "activity"} controls="ui-tab-panel" onClick={() => setActiveTab("activity")}>
              Activity
            </Tab>
          </TabList>
          <div id="ui-tab-panel" role="tabpanel" className="ui-kit-tab-panel">
            {activeTab === "overview" ? "Overview tab content" : "Activity tab content"}
          </div>
          <FilterToolbar label="UI Kit filters">
            <Field label="Search" htmlFor="ui-search">
              <TextInput id="ui-search" type="search" placeholder="Search records" />
            </Field>
            <Field label="Region" htmlFor="ui-region">
              <Select id="ui-region" defaultValue="">
                <option value="">All regions</option>
                <option>North</option>
                <option>South</option>
              </Select>
            </Field>
            <Button variant="secondary">Clear</Button>
          </FilterToolbar>
        </Panel>

        <Panel>
          <PageHeader title="Status and feedback" subtitle="Metrics, badges, loading, empty, and recovery states." />
          <div className="ui-kit-metric-grid">
            <MetricCard label="Bookings" value="128" helper="Current scope" />
            <MetricCard label="Connected" value="1" helper="Email sender" />
          </div>
          <div className="ui-kit-badge-row">
            <StatusBadge variant="success">Active</StatusBadge>
            <StatusBadge variant="warning">Pending</StatusBadge>
            <StatusBadge variant="danger">Inactive</StatusBadge>
          </div>
          <div className="ui-kit-state-grid">
            <LoadingState title="Loading bookings" description="Retrieving the latest information." />
            <ErrorState
              title="Unable to load"
              description="Try the request again."
              showHome={false}
              onRetry={() => {}}
            />
            <EmptyState title="No data yet" description="This is the standard empty-state block." />
          </div>
        </Panel>

        <Panel>
          <PageHeader title="Data table" subtitle="Shared responsive table framing and row actions." />
          <DataTable aria-label="UI Kit region example">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>North Region</td>
                <td>
                  <StatusBadge variant="success">Active</StatusBadge>
                </td>
                <td>
                  <Button variant="secondary" size="sm">
                    Edit
                  </Button>
                </td>
              </tr>
            </tbody>
          </DataTable>
          <LinkButton href="/">Back to dashboard</LinkButton>
        </Panel>

        <Panel>
          <PageHeader title="Overlays" subtitle="Shared modal and side-drawer lifecycle behavior." />
          <div className="ui-kit-control-grid">
            <Button onClick={() => setModalOpen(true)}>Open modal</Button>
            <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
              Open drawer
            </Button>
          </div>
        </Panel>

        <ModalShell
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          className="confirmation-modal warning"
          ariaLabelledBy="ui-kit-modal-title"
        >
          <header className="modal-header">
            <div>
              <span className="modal-eyebrow">Preview</span>
              <h2 id="ui-kit-modal-title">Shared modal</h2>
              <p>Common focus, Escape, and backdrop behavior.</p>
            </div>
            <CloseButton className="modal-close-button" onClick={() => setModalOpen(false)} />
          </header>
          <div className="modal-form-actions">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button>Confirm</Button>
          </div>
        </ModalShell>

        {drawerOpen ? (
          <SideDrawer onClose={() => setDrawerOpen(false)} labelledBy="ui-kit-drawer-title">
            <header className="modal-header">
              <div>
                <span className="modal-eyebrow">Details</span>
                <h2 id="ui-kit-drawer-title">Shared drawer</h2>
                <p>Responsive side-panel behavior.</p>
              </div>
              <CloseButton className="modal-close-button" onClick={() => setDrawerOpen(false)} />
            </header>
            <div className="drawer-actions">
              <Button onClick={() => setDrawerOpen(false)}>Done</Button>
            </div>
          </SideDrawer>
        ) : null}
      </section>
    </main>
  );
}
