"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export default function AutocompleteCombobox({
  id,
  name,
  options = [],
  defaultValue = "",
  value,
  onChange,
  placeholder = "Type to search",
  required = false,
  disabled = false,
  allowCustom = false
}) {
  const generatedId = useId();
  const inputId = id || `combobox-${generatedId}`;
  const listboxId = `${inputId}-options`;
  const controlled = value !== undefined;
  const initialOption = options.find((option) => option.value === (controlled ? value : defaultValue));
  const [selectedValue, setSelectedValue] = useState(controlled ? value : defaultValue);
  const [query, setQuery] = useState(initialOption?.label || (allowCustom ? (controlled ? value : defaultValue) : ""));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const currentValue = controlled ? value : selectedValue;

  useEffect(() => {
    if (!controlled) return;
    const option = options.find((item) => item.value === value);
    setQuery(option?.label || (allowCustom ? value || "" : ""));
  }, [allowCustom, controlled, options, value]);

  const filteredOptions = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search || options.some((option) => option.value === currentValue && option.label === query)) return options;
    return options.filter((option) =>
      `${option.label} ${option.value} ${option.keywords || ""}`.toLowerCase().includes(search)
    );
  }, [currentValue, options, query]);

  function commit(option) {
    if (!option) return;
    if (!controlled) setSelectedValue(option.value);
    setQuery(option.label);
    setOpen(false);
    setActiveIndex(-1);
    onChange?.(option.value, option);
  }

  function updateQuery(nextQuery) {
    setQuery(nextQuery);
    setOpen(true);
    setActiveIndex(-1);
    const exact = options.find(
      (option) =>
        option.label.toLowerCase() === nextQuery.trim().toLowerCase() ||
        option.value.toLowerCase() === nextQuery.trim().toLowerCase()
    );
    const nextValue = exact?.value || (allowCustom ? nextQuery.trim() : "");
    if (!controlled) setSelectedValue(nextValue);
    onChange?.(nextValue, exact || null);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, filteredOptions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      commit(filteredOptions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className={`autocomplete-combobox${open ? " open" : ""}`}>
      <input type="hidden" name={name} value={currentValue || (allowCustom ? query.trim() : "")} />
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? `${inputId}-option-${activeIndex}` : undefined}
        autoComplete="off"
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => updateQuery(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        className="autocomplete-toggle"
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={open ? "Close suggestions" : "Show suggestions"}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setOpen((current) => !current);
          inputRef.current?.focus();
        }}
      >
        <span aria-hidden="true">&#9662;</span>
      </button>
      {open ? (
        <div id={listboxId} className="autocomplete-options" role="listbox">
          {filteredOptions.length ? (
            filteredOptions.map((option, index) => (
              <button
                id={`${inputId}-option-${index}`}
                className={index === activeIndex ? "active" : ""}
                type="button"
                role="option"
                aria-selected={option.value === currentValue}
                key={option.value}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(option)}
              >
                <span>{option.label}</span>
                {option.description ? <small>{option.description}</small> : null}
              </button>
            ))
          ) : (
            <div className="autocomplete-empty">No matching suggestions</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
