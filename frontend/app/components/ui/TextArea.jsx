"use client";

import { forwardRef } from "react";

const TextArea = forwardRef(function TextArea(props, ref) {
  const { className = "", ...rest } = props;
  return <textarea ref={ref} className={`app-textarea ${className}`.trim()} {...rest} />;
});

export default TextArea;
