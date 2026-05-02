import React from "react";

export const Pill = ({ label, bg = "#efeaff", text = "#5a3de8", icon, testid }) => (
  <span
    className="pill"
    style={{ background: bg, color: text }}
    data-testid={testid}
  >
    {icon}
    {label}
  </span>
);

export default Pill;
