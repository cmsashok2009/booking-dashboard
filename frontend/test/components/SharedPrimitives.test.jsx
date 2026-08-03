import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Checkbox from "../../app/components/ui/Checkbox";
import DataTable from "../../app/components/ui/DataTable";
import EmptyState from "../../app/components/ui/EmptyState";
import Field from "../../app/components/ui/Field";
import FilterToolbar from "../../app/components/ui/FilterToolbar";
import GroupedTabs from "../../app/components/ui/GroupedTabs";
import LinkButton from "../../app/components/ui/LinkButton";
import LoadingState from "../../app/components/ui/LoadingState";
import MetricCard from "../../app/components/ui/MetricCard";
import NavigationItem from "../../app/components/ui/NavigationItem";
import PageHeader from "../../app/components/ui/PageHeader";
import Panel from "../../app/components/ui/Panel";
import Select from "../../app/components/ui/Select";
import StatusBadge from "../../app/components/ui/StatusBadge";
import Table from "../../app/components/ui/Table";
import { Tab, TabList } from "../../app/components/ui/Tabs";
import TextArea from "../../app/components/ui/TextArea";
import TextInput from "../../app/components/ui/TextInput";

describe("shared primitives", () => {
  it("connects field labels, hints, required state, and errors", () => {
    render(
      <Field label="Email" htmlFor="email" required hint="Work address" error="Required" className="wide">
        <TextInput id="email" />
      </Field>
    );
    expect(screen.getByLabelText(/email/i)).toHaveClass("app-input");
    expect(screen.getByText("Work address")).toHaveClass("field-hint");
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
    expect(screen.getByText("*")).toHaveClass("required-marker");
  });

  it("renders checkbox states and propagates changes", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Include user" hint="Optional" error="Select one" className="choice" onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /Include user/ }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent("Select one");
  });

  it("renders semantic table wrappers", () => {
    const { rerender } = render(
      <DataTable className="outer" tableClassName="inner" aria-label="Users">
        <tbody>
          <tr>
            <td>Ada</td>
          </tr>
        </tbody>
      </DataTable>
    );
    expect(screen.getByRole("table", { name: "Users" })).toHaveClass("inner");
    rerender(
      <Table className="compact" aria-label="Bookings">
        <tbody>
          <tr>
            <td>SOB1</td>
          </tr>
        </tbody>
      </Table>
    );
    expect(screen.getByRole("table", { name: "Bookings" })).toHaveClass("app-table");
    expect(screen.getByRole("region", { name: "Bookings" })).toHaveAttribute("tabindex", "0");
  });

  it("renders empty, loading, panel, metric, and page-header composition", () => {
    render(
      <>
        <EmptyState title="No users" description="Try another filter" action={<button>Reset</button>} />
        <LoadingState title="Loading users" description="" className="busy" />
        <Panel aria-label="Summary">Panel</Panel>
        <MetricCard label="Total" value="12" helper="Today" tone="success" className="metric" />
        <PageHeader title="Users" subtitle="Manage access" badge={<span>Active</span>} actions={<button>Add</button>} />
      </>
    );
    expect(screen.getByRole("heading", { name: "No users" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Loading users" }).closest(".app-loading-state")).toHaveAttribute(
      "aria-busy",
      "true"
    );
    expect(screen.getByRole("region", { name: "Summary" })).toHaveClass("app-panel");
    expect(screen.getByText("12").closest(".metric-card")).toHaveClass("metric-success");
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("renders navigation, tabs, toolbar, links, badges, and form controls", async () => {
    const onClick = vi.fn();
    render(
      <>
        <FilterToolbar label="Booking filters">
          <TextInput aria-label="Search" className="search" />
        </FilterToolbar>
        <NavigationItem active onClick={onClick}>
          Dashboard
        </NavigationItem>
        <TabList label="Views">
          <Tab selected controls="panel-a">
            Workflow
          </Tab>
          <Tab controls="panel-b">Source</Tab>
        </TabList>
        <LinkButton href="/download" variant="secondary" className="download">
          Download
        </LinkButton>
        <StatusBadge variant="success" className="state">
          Ready
        </StatusBadge>
        <Select aria-label="Region">
          <option>North</option>
        </Select>
        <TextArea aria-label="Notes" className="notes" />
      </>
    );
    expect(screen.getByRole("search", { name: "Booking filters" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("tab", { name: "Workflow" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: "Download" })).toHaveClass("secondary-link");
    expect(screen.getByText("Ready").closest(".status-pill")).toHaveClass("active");
    expect(screen.getByRole("combobox", { name: "Region" })).toHaveClass("app-select");
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveClass("app-textarea", "notes");
  });
  it("connects grouped parent tabs to the child tablist", () => {
    render(
      <GroupedTabs
        label="Business Settings"
        groups={[
          { id: "access", label: "Access Data", items: [{ value: "roles", label: "Roles" }] },
          { id: "workflow", label: "Booking Workflow", items: [{ value: "category", label: "Category" }] }
        ]}
        value="category"
        onChange={vi.fn()}
        controls="settings-panel"
        idPrefix="business-settings"
      />
    );
    const parentTab = screen.getByRole("tab", { name: "Booking Workflow" });
    expect(parentTab).toHaveAttribute("aria-controls", "business-settings-children");
    expect(screen.getByRole("tablist", { name: "Booking Workflow sections" })).toHaveAttribute(
      "id",
      "business-settings-children"
    );
  });
});
