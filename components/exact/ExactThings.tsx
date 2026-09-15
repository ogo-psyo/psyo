'use client';

import { useRef } from 'react';
import type { WishlistView } from '@/lib/wishlistView';
import { ExactIcon, ExactPage } from './ExactShell';

type Props = {
  items: WishlistView[]; draft: string; onDraft: (value: string) => void;
  busy: boolean; issue?: { scope: string; message: string } | null;
  captureOpen: boolean; onCaptureOpen: (open:boolean)=>void; category:string; onCategory:(value:string)=>void; reason:string; onReason:(value:string)=>void;
  needsReminder:boolean; onNeedsReminder:(value:boolean)=>void; plannedFor:string; onPlannedFor:(value:string)=>void;
  onAdd: () => Promise<boolean>; onComplete: (item: WishlistView) => Promise<unknown>;
  onReturn: (item: WishlistView) => Promise<unknown>; onBack: () => void;
  editingId: string | null; editTitle: string; editReason: string;
  onEdit: (item: WishlistView) => void; onCloseEdit: () => void;
  onEditDraft: (patch: { title?: string; reason?: string }) => void;
  onSaveEdit: (id: string) => Promise<unknown>; onDelete: (id: string) => Promise<unknown>;
  removed: boolean; onRestore: () => Promise<unknown>; onOpenPlan: (item: WishlistView) => void;

};
export function ExactThings(props: Props) {
  const { items, draft, onDraft, busy, issue, onAdd, onComplete, onReturn, onBack } = props;
  const input = useRef<HTMLInputElement>(null);
  const editing = items.find(item => item.id === props.editingId);
  if (editing) return <ExactPage viewKey={`thing:${editing.id}`} onBack={props.onCloseEdit}>
    <h1>О покупке</h1><form className="wishlist-edit-form" onSubmit={event => { event.preventDefault(); if (!busy) void props.onSaveEdit(editing.id); }}><fieldset disabled={busy}>
      <div className="field"><label htmlFor="edit-thing-title">Название</label><input id="edit-thing-title" required maxLength={160} value={props.editTitle} onChange={event => props.onEditDraft({title:event.target.value})} /></div>
      <div className="field"><label htmlFor="edit-thing-reason">Зачем · необязательно</label><input id="edit-thing-reason" maxLength={500} value={props.editReason} onChange={event => props.onEditDraft({reason:event.target.value})} /></div>
      <button type="submit" className="primary full">{busy?'Сохраняю…':'Сохранить'}</button>
      {editing.plannedFor && <button type="button" className="text-button" onClick={() => props.onOpenPlan(editing)}>Открыть в плане</button>}
      {editing.url && <a className="text-button" href={editing.url} target="_blank" rel="noreferrer">Открыть ссылку</a>}
      <button type="button" className="text-button" onClick={async () => { if (await props.onDelete(editing.id)) props.onCloseEdit(); }}>Убрать покупку</button>
      {issue?.scope === editing.id && <p className="error" role="alert">{issue.message}</p>}
    </fieldset></form>
  </ExactPage>;
  return <ExactPage viewKey="things" onBack={onBack}>
    <h1>Нужно купить</h1><p className="lead">Чтобы не держать всё в голове.</p>
    <form onSubmit={async event => { event.preventDefault(); if (!draft.trim() || busy) return; if (await onAdd()) input.current?.focus(); }}>
      <label htmlFor="thing-name">Что нужно?</label><div className="inline-add">
        <input ref={input} id="thing-name" placeholder="Например, корм" autoComplete="off" maxLength={160} value={draft} disabled={busy} onChange={event => onDraft(event.target.value)} required />
        <button className="primary" type="submit" aria-label={props.needsReminder ? 'Добавить в вещи и план' : 'Добавить покупку'} disabled={busy || !draft.trim() || props.needsReminder && !props.plannedFor}><ExactIcon name="plus" /></button>
      </div>
      <details open={props.captureOpen} onToggle={event=>props.onCaptureOpen(event.currentTarget.open)}><summary>Категория, пояснение и срок</summary>
        <div className="field"><label htmlFor="exact-thing-category">Категория</label><select id="exact-thing-category" value={props.category} onChange={event=>props.onCategory(event.target.value)}>{[['gear','Амуниция'],['food','Корм'],['treats','Лакомства'],['toy','Игрушка'],['health','Здоровье'],['grooming','Груминг'],['service','Сервис'],['other','Другое']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
        <div className="field"><label htmlFor="exact-thing-reason">Зачем · необязательно</label><input id="exact-thing-reason" value={props.reason} maxLength={500} onChange={event=>props.onReason(event.target.value)}/></div>
        <label className="exact-checkbox"><input type="checkbox" checked={props.needsReminder} onChange={event=>props.onNeedsReminder(event.target.checked)}/>Добавить в план</label>
        {props.needsReminder && <div className="field"><label htmlFor="exact-thing-date">Купить до</label><input id="exact-thing-date" type="date" required value={props.plannedFor} onChange={event=>props.onPlannedFor(event.target.value)}/></div>}
      </details>{issue && ['create', 'assistant:create'].includes(issue.scope) && <p className="error" role="alert">{issue.message}</p>}
    </form>
    <div className="list section-gap">{items.filter(item => ['wanted', 'bought'].includes(item.status)).map(item => {
      const bought = item.status === 'bought';
      return <div key={item.id} data-wishlist-id={item.id}>
        <div className="task"><button type="button" className={`check-button${bought ? ' done' : ''}`} aria-label={`${bought ? 'Вернуть' : 'Куплено'}: ${item.title}`} disabled={busy} onClick={() => { void (bought ? onReturn(item) : onComplete(item)); }}>{bought && <ExactIcon name="check" />}</button>
          <span className="grow"><button type="button" className="exact-task-title" onClick={() => props.onEdit(item)} aria-label={`Изменить: ${item.title}`}><strong className={bought ? 'done-text' : undefined}>{item.title}</strong></button>{bought && <small>Куплено · нажми, чтобы вернуть</small>}</span>
        </div>{issue?.scope === item.id && <p className="error" role="alert">{issue.message}</p>}
      </div>;
    })}</div>
    {props.removed && <div role="status"><span>Покупка убрана.</span><button type="button" className="text-button" disabled={busy} onClick={() => void props.onRestore()}>Вернуть</button>{issue?.scope==='restore'&&<p className="error" role="alert">{issue.message}</p>}</div>}
    <p className="hint section-gap">{props.needsReminder ? 'Покупка и дело сохранятся вместе на выбранную дату.' : 'Без напоминания на завтра. Здесь только список.'}</p>
  </ExactPage>;
}
