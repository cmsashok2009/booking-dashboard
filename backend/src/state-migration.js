import { createHash } from "node:crypto";

function canonicalize(value) {
  if (Array.isArray(value)) {
    const canonical = value.map(canonicalize);
    const identities = canonical.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      if (item.templateId && item.version) return `${item.templateId}:${item.version}`;
      return item.id || item.code ? String(item.id || item.code) : null;
    });
    if (identities.every(Boolean)) {
      return canonical
        .map((item, index) => ({ item, identity: identities[index] }))
        .sort((left, right) => left.identity.localeCompare(right.identity))
        .map(({ item }) => item);
    }
    return canonical;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function stableId(prefix, value) {
  const suffix = createHash("sha256").update(String(value)).digest("hex").slice(0, 20);
  return `${prefix}-${suffix}`;
}

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

export function prepareLegacyState(input) {
  const data = structuredClone(validateLegacyState(input));
  data.regions ||= [];
  data.dealerCodes ||= [];
  const regionByName = new Map(data.regions.map((item) => [normalized(item.name), item]));
  const regionNames = [
    ...(data.users || []).map((item) => item.region),
    ...(data.bookings || []).map((item) => item.region),
    ...(data.dealerAssignments || []).map((item) => item.region),
  ].filter((name) => normalized(name) && normalized(name) !== "all");
  for (const name of regionNames) {
    const key = normalized(name);
    if (regionByName.has(key)) continue;
    const region = { id: stableId("region", key), name: String(name).trim(), status: "active" };
    data.regions.push(region);
    regionByName.set(key, region);
  }
  const dealerByCode = new Map(data.dealerCodes.map((item) => [normalized(item.code), item]));
  const dealers = [
    ...(data.bookings || []).map((item) => ({ code: item.dealerCode, region: item.region })),
    ...(data.dealerAssignments || []).map((item) => ({ code: item.dealerCode, region: item.region })),
  ];
  for (const source of dealers) {
    const code = normalized(source.code);
    if (!code || dealerByCode.has(code)) continue;
    const dealer = { id: stableId("dealer-code", code), code: String(source.code).trim().toUpperCase(), region: String(source.region || "").trim(), status: "active" };
    data.dealerCodes.push(dealer);
    dealerByCode.set(code, dealer);
  }
  const templateById = new Map((data.emailTemplates || []).map((item) => [item.id, item]));
  const versions = new Map();
  for (const template of data.emailTemplates || []) {
    const version = Number(template.version || 1);
    versions.set(`${template.id}:${version}`, { ...template, templateId: template.id, version });
  }
  for (const campaign of data.emailCampaigns || []) {
    const version = Number(campaign.templateVersion || 1);
    const key = `${campaign.templateId}:${version}`;
    if (versions.has(key)) continue;
    const template = templateById.get(campaign.templateId);
    if (!template) throw new Error(`Campaign ${campaign.id} references missing template ${campaign.templateId}`);
    versions.set(key, {
      ...template,
      templateId: template.id,
      version,
      migrationProvenance: "reconstructed-from-current-template",
      createdAt: campaign.createdAt || template.createdAt,
    });
  }
  data.emailTemplateVersions = [...versions.values()];  return validateLegacyState(data);
}
export function stateChecksum(data) {
  return createHash("sha256").update(JSON.stringify(canonicalize(data))).digest("hex");
}

export function validateLegacyState(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Legacy state must be a JSON object");
  const duplicates = [];
  for (const [collection, values] of Object.entries(data)) {
    if (!Array.isArray(values)) continue;
    const seen = new Set();
    for (const entity of values) {
      if (!entity || typeof entity !== "object") continue;
      const identity = collection === "emailTemplateVersions"
        ? `${entity.templateId || entity.id}:${Number(entity.version || 1)}`
        : entity.id && String(entity.id);
      if (!identity) continue;
      if (seen.has(identity)) duplicates.push(`${collection}:${identity}`);
      seen.add(identity);
    }
  }
  for (const [field, values] of Object.entries(data.lookupOptions || {})) {
    if (!Array.isArray(values)) throw new Error(`lookupOptions.${field} must be an array`);
    const seen = new Set();
    for (const entity of values) {
      if (!entity || typeof entity !== "object" || !entity.id) continue;
      const id = String(entity.id);
      if (seen.has(id)) duplicates.push(`lookupOptions.${field}:${id}`);
      seen.add(id);
    }
  }
  if (duplicates.length) throw new Error(`Legacy state contains duplicate entity IDs: ${duplicates.join(", ")}`);
  return data;
}

export function stateInventory(data) {
  const inventory = {};
  for (const [key, value] of Object.entries(data)) if (Array.isArray(value)) inventory[key] = value.length;
  inventory.lookupOptions = Object.values(data.lookupOptions || {}).reduce((total, values) => total + (Array.isArray(values) ? values.length : 0), 0);
  return inventory;
}

export function reconcileStates(source, destination) {
  validateLegacyState(source);
  validateLegacyState(destination);
  const sourceChecksum = stateChecksum(source);
  const destinationChecksum = stateChecksum(destination);
  const differingKeys = [...new Set([...Object.keys(source), ...Object.keys(destination)])]
    .filter((key) => stateChecksum(source[key]) !== stateChecksum(destination[key]))
    .sort();
  return {
    matches: sourceChecksum === destinationChecksum,
    sourceChecksum,
    destinationChecksum,
    sourceInventory: stateInventory(source),
    destinationInventory: stateInventory(destination),
    differingKeys,
  };
}