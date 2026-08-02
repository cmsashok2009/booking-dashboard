"use client";

import { forwardRef } from "react";

const TextInput = forwardRef(function TextInput(props, ref) {
  const { className = "", ...rest } = props;
  return <input ref={ref} className={`app-input ${className}`.trim()} {...rest} />;
});

export default TextInput;
