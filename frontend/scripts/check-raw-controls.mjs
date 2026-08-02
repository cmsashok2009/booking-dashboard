import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../app/", import.meta.url));
const extensions = new Set([".js", ".jsx"]);
const allowed = new Map([
  ["components/ui/Button.jsx", "shared button primitive"],
  ["components/ui/Checkbox.jsx", "shared checkbox primitive"],
  ["components/ui/FileInput.jsx", "shared file-input primitive"],
  ["components/ui/NavigationItem.jsx", "shared navigation primitive"],
  ["components/ui/Select.jsx", "shared select primitive"],
  ["components/ui/Tabs.jsx", "shared tabs primitive"],
  ["components/ui/TextArea.jsx", "shared textarea primitive"],
  ["components/ui/TextInput.jsx", "shared text-input primitive"],
  ["components/AutocompleteCombobox.jsx", "ARIA combobox composite"],
  ["components/EditableUsersTable.jsx", "sortable table-header composite"],
  ["components/NotificationDrawer.jsx", "notification-row composite"],
  ["features/dashboard/DashboardMetrics.jsx", "interactive metric-card composite"]
]);
const controls = /<(button|input|select|textarea)\b/g;
const findings = [];
let files = 0;
let approved = 0;

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (extensions.has(extname(entry.name))) inspect(path);
  }
}

function inspect(path) {
  files += 1;
  const display = relative(root, path).replaceAll("\\", "/");
  const source = readFileSync(path, "utf8");
  for (const match of source.matchAll(controls)) {
    const line = source.slice(0, match.index).split(/\r?\n/).length;
    if (allowed.has(display)) approved += 1;
    else findings.push(`${display}:${line} contains raw <${match[1]}> outside an approved primitive/composite`);
  }
}

visit(root);
if (findings.length) {
  console.error("Raw-control ownership check failed:");
  for (const finding of findings) console.error(`  ${finding}`);
  process.exitCode = 1;
} else {
  console.log(
    `Control ownership check passed: ${files} app modules; ${approved} raw controls confined to documented primitives/composites.`
  );
}
