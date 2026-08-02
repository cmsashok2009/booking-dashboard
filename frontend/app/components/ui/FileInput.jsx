"use client";

import { forwardRef } from "react";

const FileInput = forwardRef(function FileInput({ className = "", ...props }, ref) {
  return <input ref={ref} type="file" className={`app-file-input ${className}`.trim()} {...props} />;
});

export default FileInput;
