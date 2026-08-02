import { randomUUID } from "node:crypto";

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function ensureAccessMasterData(db) {
  let changed = false;
  if (!Array.isArray(db.regions)) {
    db.regions = [];
    changed = true;
  }
  if (!Array.isArray(db.dealerCodes)) {
    db.dealerCodes = [];
    changed = true;
  }

  const knownRegions = [
    ...db.regions.map((item) => item.name),
    ...(db.bookings || []).map((item) => item.region),
    ...(db.users || []).map((item) => item.region),
    ...(db.dealerAssignments || []).map((item) => item.region)
  ].map(normalizeText).filter((value) => value && value.toLowerCase() !== "all");

  for (const name of knownRegions) {
    if (!db.regions.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      db.regions.push({ id: `region-${randomUUID()}`, name, status: "active", createdAt: new Date().toISOString() });
      changed = true;
    }
  }

  const knownDealers = [
    ...(db.dealerCodes || []),
    ...(db.bookings || []).map((item) => ({ code: item.dealerCode, region: item.region })),
    ...(db.dealerAssignments || []).map((item) => ({ code: item.dealerCode, region: item.region }))
  ];
  for (const source of knownDealers) {
    const code = normalizeText(source.code).toUpperCase();
    if (!code || db.dealerCodes.some((item) => item.code.toUpperCase() === code)) continue;
    db.dealerCodes.push({
      id: `dealer-code-${randomUUID()}`,
      code,
      region: normalizeText(source.region),
      status: "active",
      createdAt: new Date().toISOString()
    });
    changed = true;
  }
  return changed;
}

export function createRegion(db, input, actorId) {
  ensureAccessMasterData(db);
  db.auditLogs ||= [];
  const name = normalizeText(input.name);
  if (!name) return { error: "Region name is required.", code: "REGION_REQUIRED", status: 422 };
  if (name.length > 60 || !/^[a-z0-9][a-z0-9 .&'/-]*$/i.test(name)) {
    return { error: "Use 1 to 60 letters, numbers, spaces, apostrophes, periods, ampersands, slashes, or hyphens.", code: "REGION_INVALID", status: 422 };
  }
  const existing = db.regions.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (existing) return { error: `Region "${existing.name}" already exists.`, code: "REGION_EXISTS", status: 409, existing };
  const now = new Date().toISOString();
  const region = { id: `region-${randomUUID()}`, name, status: "active", createdAt: now };
  db.regions.push(region);
  db.auditLogs.unshift({ id: `audit-${randomUUID()}`, action: "region_created", entityId: region.id, userId: actorId, createdAt: now });
  return { region };
}

export function createDealerCode(db, input, actorId) {
  ensureAccessMasterData(db);
  db.auditLogs ||= [];
  const code = normalizeText(input.code).toUpperCase();
  const regionName = normalizeText(input.region);
  if (!code) return { error: "Dealer Code is required.", code: "DEALER_CODE_REQUIRED", status: 422 };
  if (code.length > 30 || !/^[A-Z0-9][A-Z0-9._/-]*$/.test(code)) {
    return { error: "Use 1 to 30 uppercase letters, numbers, periods, underscores, slashes, or hyphens.", code: "DEALER_CODE_INVALID", status: 422 };
  }
  const existing = db.dealerCodes.find((item) => item.code.toUpperCase() === code);
  if (existing) return { error: `Dealer Code "${existing.code}" already exists.`, code: "DEALER_CODE_EXISTS", status: 409, existing };
  const region = db.regions.find((item) => item.status === "active" && item.name.toLowerCase() === regionName.toLowerCase());
  if (!region) return { error: "Select an existing active Region.", code: "DEALER_REGION_INVALID", status: 422 };
  const now = new Date().toISOString();
  const dealerCode = { id: `dealer-code-${randomUUID()}`, code, region: region.name, status: "active", createdAt: now };
  db.dealerCodes.push(dealerCode);
  db.auditLogs.unshift({ id: `audit-${randomUUID()}`, action: "dealer_code_created", entityId: dealerCode.id, userId: actorId, outcome: { region: region.name }, createdAt: now });
  return { dealerCode };
}

export function updateRegion(db, regionId, input, actorId) {
  ensureAccessMasterData(db);
  db.auditLogs ||= [];
  const region = db.regions.find((item) => item.id === regionId);
  if (!region) return { error: "Region not found.", code: "REGION_NOT_FOUND", status: 404 };
  const name = normalizeText(input.name ?? region.name);
  if (!name || name.length > 60 || !/^[a-z0-9][a-z0-9 .&'/-]*$/i.test(name)) {
    return { error: "Enter a valid Region name using no more than 60 characters.", code: "REGION_INVALID", status: 422 };
  }
  const duplicate = db.regions.some((item) => item.id !== region.id && item.name.toLowerCase() === name.toLowerCase());
  if (duplicate) return { error: `Region "${name}" already exists.`, code: "REGION_EXISTS", status: 409 };
  const status = input.status ?? region.status;
  if (!["active", "inactive"].includes(status)) return { error: "Region status must be active or inactive.", code: "REGION_STATUS_INVALID", status: 422 };
  if (status === "inactive" && db.dealerCodes.some((item) => item.status === "active" && item.region.toLowerCase() === region.name.toLowerCase())) {
    return { error: "Deactivate or move the active Dealer Codes assigned to this Region first.", code: "REGION_IN_USE", status: 409 };
  }
  const now = new Date().toISOString();
  Object.assign(region, { name, status, updatedAt: now });
  db.auditLogs.unshift({ id: `audit-${randomUUID()}`, action: "region_updated", entityId: region.id, userId: actorId, outcome: { status }, createdAt: now });
  return { region };
}

export function updateDealerCode(db, dealerCodeId, input, actorId) {
  ensureAccessMasterData(db);
  db.auditLogs ||= [];
  const dealerCode = db.dealerCodes.find((item) => item.id === dealerCodeId);
  if (!dealerCode) return { error: "Dealer Code not found.", code: "DEALER_CODE_NOT_FOUND", status: 404 };
  const code = normalizeText(input.code ?? dealerCode.code).toUpperCase();
  if (!code || code.length > 30 || !/^[A-Z0-9][A-Z0-9._/-]*$/.test(code)) {
    return { error: "Enter a valid Dealer Code using no more than 30 characters.", code: "DEALER_CODE_INVALID", status: 422 };
  }
  const duplicate = db.dealerCodes.some((item) => item.id !== dealerCode.id && item.code.toUpperCase() === code);
  if (duplicate) return { error: `Dealer Code "${code}" already exists.`, code: "DEALER_CODE_EXISTS", status: 409 };
  const regionName = normalizeText(input.region ?? dealerCode.region);
  const region = db.regions.find((item) => item.status === "active" && item.name.toLowerCase() === regionName.toLowerCase());
  if (!region) return { error: "Select an existing active Region.", code: "DEALER_REGION_INVALID", status: 422 };
  const status = input.status ?? dealerCode.status;
  if (!["active", "inactive"].includes(status)) return { error: "Dealer Code status must be active or inactive.", code: "DEALER_CODE_STATUS_INVALID", status: 422 };
  const now = new Date().toISOString();
  Object.assign(dealerCode, { code, region: region.name, status, updatedAt: now });
  db.auditLogs.unshift({ id: `audit-${randomUUID()}`, action: "dealer_code_updated", entityId: dealerCode.id, userId: actorId, outcome: { region: region.name, status }, createdAt: now });
  return { dealerCode };
}
