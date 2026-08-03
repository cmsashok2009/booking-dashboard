"use client";

import Select from "../../components/ui/Select";

export default function EditableUserRegionField({
  userName,
  region,
  dealerCode,
  regions,
  dealerCodes,
  errors,
  onRegionChange,
  onDealerCodeChange
}) {
  const availableDealerCodes = dealerCodes.filter(
    (item) => item.region === region && (item.status === "active" || item.code === dealerCode)
  );

  return (
    <>
      <Select
        aria-label={`Region for ${userName}`}
        className={errors.region ? "input-error" : ""}
        value={region}
        onChange={(event) => onRegionChange(event.target.value)}
      >
        <option value="">Select region</option>
        {regions.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </Select>
      <Select
        aria-label={`Dealer Code for ${userName}`}
        className={errors.dealerCode ? "input-error" : ""}
        value={dealerCode}
        onChange={(event) => onDealerCodeChange(event.target.value)}
      >
        <option value="">No Dealer Code</option>
        {availableDealerCodes.map((item) => (
          <option key={item.id || item.code} value={item.code}>
            {item.code}
          </option>
        ))}
      </Select>
      {errors.dealerCode ? <span className="field-error">{errors.dealerCode}</span> : null}
      <span className="field-hint">Changing Region clears an incompatible Dealer Code.</span>
    </>
  );
}
