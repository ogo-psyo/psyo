'use client';

import { useId } from 'react';

/** Short choices keep native radio keyboard/label semantics without a separate picker. */
export function ChoiceField<T extends string | number>({ label, value, options, onChange, disabled = false }: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return <fieldset className="pso-choices" disabled={disabled}>
    <legend>{label}</legend>
    <div className="pso-choice-options">{options.map(option => <label className="pso-choice" key={option.value}>
      <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
      <span>{option.label}</span>
    </label>)}</div>
  </fieldset>;
}
