export function formValues(form) {
  return Array.from(form.elements).reduce((values, element) => {
    if (!element.name || element.disabled) return values;
    if (element.type === "checkbox") {
      values[element.name] = element.checked;
      return values;
    }
    values[element.name] = element.value;
    return values;
  }, {});
}
