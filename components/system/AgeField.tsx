'use client';

import { useRef, useState } from 'react';
import { ageGroup, ageGroupChoices } from '@/lib/profileFieldChoices';
import { ChoiceField } from './ChoiceField';

export function AgeField({ id, value, onChange, disabled = false }: { id: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [mode, setMode] = useState<'exact' | 'group'>(() => ageGroup(value) ? 'group' : 'exact');
  const drafts = useRef({ exact: ageGroup(value) ? '' : value, group: ageGroup(value) || '' });
  return <div className="pso-age-field">
    <ChoiceField label="Как указать возраст" value={mode} disabled={disabled}
      options={[{ value: 'exact', label: 'Точный возраст' }, { value: 'group', label: 'Возрастная группа' }]}
      onChange={next => { drafts.current[mode] = value; setMode(next); onChange(drafts.current[next]); }} />
    {mode === 'exact' ? <div className="field"><label htmlFor={id}>Возраст</label>
      <input id={id} value={value} onChange={event => onChange(event.target.value)} placeholder="2 года 4 месяца" maxLength={60} autoComplete="off" disabled={disabled} />
    </div> : <ChoiceField label="Возрастная группа" value={ageGroup(value) || ''} disabled={disabled}
      options={[{ value: '', label: 'Не знаю' }, ...ageGroupChoices]} onChange={onChange} />}
  </div>;
}
