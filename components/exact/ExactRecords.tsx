'use client';

import { useState, type ComponentProps } from 'react';
import type { HealthTimelineScreen } from '@/components/health/HealthTimelineScreen';
import { observationMetricDefinitions } from '@/components/health/ObservationMetricFields';
import { isPrimaryObservationFact, observationTypeLabel } from '@/lib/observationLabels';
import { inflectPetName } from '@/lib/copy';
import { ExactIcon, ExactPage, ExactRow } from './ExactShell';

type Props = Omit<ComponentProps<typeof HealthTimelineScreen>, 'onDelete'> & { onDelete: (id: string) => Promise<boolean> } & { selectedId: string | null; onSelect: (id: string | null) => void; };
const date = (value: string) => new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

export function ExactRecords(props: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [query, setQuery] = useState('');
  const selectedId = props.selectedId, setSelectedId = props.onSelect;
  const [createdId, setCreatedId] = useState<string | null>(null);
  const selected = props.entries.find(item => item.id === selectedId);
  const editing = Boolean(props.editingId);
  const editor = editing || props.captureOpen;
  const draft = editing ? props.editDraft : props.draft;
  const change = editing ? props.onEditDraftChange : props.onDraftChange;
  const busy = props.saving || props.mutationBusy;
  const issue = props.issue?.scope === (props.editingId || 'create') ? props.issue.message : '';

  if (editor) return <ExactPage viewKey={editing ? `edit:${props.editingId}` : 'observe'} onBack={() => editing ? props.onCancelEdit() : props.onCaptureOpen(false)}>
    <p className="eyebrow">Наблюдение · {props.dogName}</p>
    <h1>{editing ? 'Изменить запись' : 'Что заметил?'}</h1>
    <p className="lead">Можно обычным текстом. Не обязательно заполнять показатели.</p>
    <form onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      if (props.editingId) { await props.onSaveEdit(props.editingId); }
      else { const result = await props.onSave(); if (result) { setSelectedId(result.id); setCreatedId(result.id); props.onCaptureOpen(false); } }
    }}>
      <fieldset disabled={busy}>
        {isPrimaryObservationFact(draft.type) && <div className="field"><label htmlFor="exact-fact-value">{observationTypeLabel(draft.type)}</label><input id="exact-fact-value" required value={draft.value || ''} onChange={event => change({ value: event.target.value })} /></div>}
        <label htmlFor="observe-text">Запись</label>
        <textarea id="observe-text" value={draft.note || ''} onChange={event => change({ note: event.target.value })} placeholder={`Как сегодня чувствует себя ${props.dogName}?`} maxLength={8000} aria-invalid={Boolean(issue)} aria-describedby={issue ? 'exact-observation-error' : undefined} />
        <details><summary>Добавить показатели</summary>{observationMetricDefinitions.map(metric => <div className="field" key={metric.key}>
          <label htmlFor={`exact-${metric.key}`}>{metric.label}</label><select id={`exact-${metric.key}`} value={draft[metric.key] || ''} onChange={event => change({ [metric.key]: event.target.value })}>
            <option value="">Не указан</option>{draft[metric.key] && !(metric.options as readonly string[]).includes(draft[metric.key]) && <option value={draft[metric.key]}>{draft[metric.key]}</option>}{metric.options.map(option=><option key={option} value={option}>{option}</option>)}
          </select></div>)}</details>
        <p id="exact-observation-error" className="error" role="alert">{issue}</p>
        <button type="submit" className="primary full" disabled={busy || !draft.note?.trim() && !draft.value?.trim() && !observationMetricDefinitions.some(metric => draft[metric.key])}>{busy ? 'Сохраняю…' : editing ? 'Сохранить изменения' : 'Сохранить запись'}</button>
      </fieldset>
    </form>
  </ExactPage>;

  if (selectedId) return <ExactPage viewKey={`record:${selectedId}`} onBack={() => setSelectedId(null)}>
    {!selected ? <><h1>Запись недоступна</h1><button type="button" className="text-button" onClick={() => setSelectedId(null)}>Открыть историю</button></> : <>
      {createdId === selected.id && <div className="status-line success" role="status"><ExactIcon name="check" />Запись сохранена</div>}
      <p className="eyebrow">{props.dogName} · {date(selected.createdAt)}</p><h1>Наблюдение</h1>
      <div className="note-paper"><p className="note-body">{selected.note || selected.value}</p>
        {isPrimaryObservationFact(selected.type) && selected.note && <p className="meta section-gap">{observationTypeLabel(selected.type)}: {selected.value}</p>}
        {observationMetricDefinitions.filter(metric => selected[metric.key]).map(metric => <p key={metric.key} className="meta section-gap">{metric.label}: {selected[metric.key]}</p>)}
      </div>
      <div className="row-actions"><button type="button" className="secondary" onClick={() => props.onStartEdit(selected)}>Изменить</button><button type="button" className="secondary" onClick={() => setSelectedId(null)}>В историю</button></div>
      {createdId === selected.id && <button type="button" className="text-button" disabled={busy} onClick={async () => { if (await props.onDelete(selected.id)) { props.onDraftChange({note:selected.note || selected.value || '',mood:selected.mood,appetite:selected.appetite,stool:selected.stool,energy:selected.energy}); setSelectedId(null); setCreatedId(null); props.onCaptureOpen(true); } }}>Отменить создание</button>}
      {createdId !== selected.id && (confirmDelete ? <div className="section-gap"><p>Убрать эту запись из истории?</p><div className="row-actions"><button type="button" className="secondary" disabled={busy} onClick={async()=>{if(await props.onDelete(selected.id)){setConfirmDelete(false);setSelectedId(null);}}}>Убрать запись</button><button type="button" className="secondary" disabled={busy} onClick={()=>setConfirmDelete(false)}>Оставить</button></div></div> : <button type="button" className="text-button" onClick={()=>setConfirmDelete(true)}>Удалить запись</button>)}
      {props.issue?.scope === selected.id && <p className="error" role="alert">{props.issue.message}</p>}
    </>}
  </ExactPage>;

  const filtered = props.entries.filter(item => {const created=new Date(item.createdAt);const day=[created.getFullYear(),String(created.getMonth()+1).padStart(2,'0'),String(created.getDate()).padStart(2,'0')].join('-');return (!filterDate || day===filterDate) && (item.note || item.value || '').toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'));});
  return <ExactPage viewKey="history" onBack={props.onBack}>
    <h1>Память о днях</h1><p className="lead">То, что ты уже замечал о {inflectPetName(props.dogName, 'loct')}.</p>
    <label htmlFor="history-search">Найти в записях</label><input id="history-search" type="search" placeholder="Слово или фраза" value={query} onChange={event => setQuery(event.target.value)} />
    <details><summary>Выбрать дату</summary><div className="field"><label htmlFor="exact-history-date">Дата записи</label><input id="exact-history-date" type="date" value={filterDate} onChange={event=>setFilterDate(event.target.value)}/></div>{filterDate && <button type="button" className="text-button" onClick={()=>setFilterDate('')}>Все даты</button>}</details>
    {props.loading && <p className="status-line" role="status">Загружаю записи…</p>}
    {props.error && <div role="alert"><p className="error">{props.error}</p><button type="button" className="secondary" onClick={() => void props.onRetry()}>Повторить</button></div>}
    <div className="list section-gap">{filtered.map(item => <ExactRow key={item.id} icon="book" title={(item.note || item.value || observationTypeLabel(item.type)).length > 65 ? `${(item.note || item.value || observationTypeLabel(item.type)).slice(0, 65)}…` : item.note || item.value || observationTypeLabel(item.type)} detail={date(item.createdAt)} onClick={() => { setCreatedId(null); setConfirmDelete(false); setSelectedId(item.id); }} />)}
      {!props.loading && !props.error && !filtered.length && <p className="empty">{query ? 'Записей с таким текстом нет. Попробуй другое слово.' : 'Здесь появится первое наблюдение.'}</p>}
    </div>
    {props.hasMore && <button type="button" className="text-button" disabled={props.loading} onClick={() => void props.onLoadMore()}>Загрузить ещё записи</button>}
    <button type="button" className="text-button" onClick={() => props.onCaptureOpen(true)}><ExactIcon name="plus" />Новая запись</button>
    {props.recentlyDeleted && <div role="status"><span>Запись убрана.</span><button type="button" className="text-button" disabled={busy} onClick={() => void props.onRestore()}>Вернуть</button></div>}
  </ExactPage>;
}
