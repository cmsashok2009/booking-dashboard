export function editableUserField(errors, key, control) {
  return (
    <div className="editable-cell-field">
      {control}
      {errors[key] ? <span className="field-error">{errors[key]}</span> : null}
    </div>
  );
}
