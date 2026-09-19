'use client';

import { useEffect, useRef, useState } from 'react';
import { searchBreeds } from '@/lib/breedSearch';

export function BreedField({ id, value, onChange, disabled = false }: { id: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const list = useRef<HTMLUListElement>(null);
  const options = searchBreeds(value);
  const visible = open && !disabled && Boolean(value.trim());
  const selected = active >= 0 && active < options.length ? active : -1;
  useEffect(() => { list.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' }); }, [active]);
  const choose = (title: string) => { onChange(title); setOpen(false); setActive(-1); };
  return <div className="field pso-breed-field" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <label htmlFor={id}>Порода</label>
    <input id={id} value={value} role="combobox" aria-autocomplete="list" aria-expanded={visible}
      aria-controls={visible ? `${id}-list` : undefined} aria-activedescendant={visible && selected >= 0 ? `${id}-option-${selected}` : undefined}
      aria-describedby={visible && !options.length ? `${id}-empty` : undefined}
      autoComplete="off" maxLength={80} disabled={disabled} placeholder="Начни вводить породу"
      onFocus={() => setOpen(true)} onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1); }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape' && visible) { event.preventDefault(); event.stopPropagation(); setOpen(false); setActive(-1); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setOpen(true);
          setActive(current => event.key === 'ArrowDown' ? Math.min(current + 1, options.length - 1) : Math.max(current - 1, 0));
        }
        if (event.key === 'Enter' && visible && selected >= 0) { event.preventDefault(); choose(options[selected].title); }
      }} />
    {visible && <>
      <ul ref={list} id={`${id}-list`} role="listbox" aria-label="Породы" className="pso-breed-options">
        {options.map((item, index) => <li key={item.title} id={`${id}-option-${index}`} role="option" aria-selected={selected === index}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(item.title)}>{item.title}</li>)}
      </ul>
      {!options.length && <p id={`${id}-empty`} className="hint" role="status">В справочнике не нашлось. Сохраним твоё название.</p>}
    </>}
  </div>;
}
