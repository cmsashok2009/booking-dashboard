"use client";

import { forwardRef } from "react";

const Select = forwardRef(function Select(props, ref) {
  const { className = "", ...rest } = props;
  return <select ref={ref} className={`app-select ${className}`.trim()} {...rest} />;
});

export default Select;
