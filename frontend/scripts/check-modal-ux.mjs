import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function read(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const manifest = read("../app/globals.css");
const styles = read("../app/styles/13-dialogs.css");
const component = read("../app/components/ui/BlockingDependencyModal.jsx");
const failures = [];

const checks = [
  [manifest.includes('@import url("./styles/13-dialogs.css")'), "globals.css must import the shared dialog stylesheet"],
  [/\.modal\.blocking-dependency-modal\s*\{/.test(styles), "the dependency modal needs a feature-specific style scope"],
  [/width:\s*min\(520px,\s*calc\(100vw - 32px\)\)/.test(styles), "desktop width must be explicitly bounded"],
  [/max-height:\s*min\(80dvh,\s*640px\)/.test(styles), "modal height must preserve surrounding context"],
  [
    /\.blocking-dependency-backdrop\s*\{[^}]*place-items:\s*start center/s.test(styles),
    "the dialog must sit in the upper viewport"
  ],
  [/@media \(width <= 520px\)/.test(styles), "a mobile modal layout is required"],
  [/@media \(prefers-reduced-motion: reduce\)/.test(styles), "reduced-motion behavior is required"],
  [/role="alertdialog"/.test(component), "blocked actions must use alertdialog semantics"],
  [/ariaLabelledBy=\{titleId\}/.test(component), "the dialog title must be programmatically associated"],
  [/ariaDescribedBy=\{descriptionId\}/.test(component), "the dialog description must be programmatically associated"],
  [
    /<dl className="blocking-dependency-detail">/.test(component),
    "dependency context must use semantic description markup"
  ],
  [/ref=\{closeRef\}/.test(component), "initial focus must land on the safe close action"]
];

for (const [passed, message] of checks) {
  if (!passed) failures.push(message);
}

if (failures.length) {
  console.error("Modal UX contract check failed:");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Modal UX contract check passed: imported, bounded, responsive, and accessible dependency dialog.");
}
