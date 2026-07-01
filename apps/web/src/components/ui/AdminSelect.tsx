'use client';

import React from 'react';

interface AdminSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function AdminSelect({ label, className = '', id, children, ...props }: AdminSelectProps) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <div>
      {label ? (
        <label htmlFor={selectId} className="block text-sm font-medium text-hos-text-secondary mb-1">
          {label}
        </label>
      ) : null}
      <select id={selectId} className={`select ${className}`.trim()} {...props}>
        {children}
      </select>
    </div>
  );
}
