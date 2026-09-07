'use client';

import { useState, type ReactNode } from 'react';
import { CandidatePhoto } from './CandidateDeck';
import { PawPrint } from '@phosphor-icons/react';
import type { SocialScenario } from '@/lib/socialCore';

export type SocialRequestView = {
  id: string;
  senderPetId: string;
  recipientPetId: string;
  scenario: SocialScenario;
  source?: 'signal' | 'organic' | 'invite';
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'blocked';
  telegramContactUrl: string | null;
  otherDog: { name: string; avatarUrl: string | null } | null;
};

const scenarioLabels: Record<SocialScenario, string> = {
  meet: 'знакомство',
  walk: 'прогулку',
  socialize: 'социализацию',
  mating: 'случку',
};

export function RequestsPanel({
  petId,
  requests,
  busyId,
  missingTelegramUsernameAction,
  onAction,
  onReport,
  onOpenChat,
  onMeeting,
  selectedId, onSelect, onBack, children, onRefresh,
}: {
  petId: string;
  requests: SocialRequestView[];
  busyId: string | null;
  missingTelegramUsernameAction: string | null;
  onAction: (id: string, action: 'accept' | 'reject' | 'cancel' | 'close' | 'block') => void | Promise<boolean | void>;
  onReport: (id: string, reason: string) => Promise<boolean>;
  onOpenChat: (url: string) => void;
  onMeeting?: (id:string)=>void;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onBack?: () => void;
  children?: ReactNode;
  onRefresh?: () => void;

}) {
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [closing, setClosing] = useState(false);
  const statusCopy = (request: SocialRequestView) => request.status === 'pending'
    ? request.recipientPetId === petId ? `Вас зовут на ${scenarioLabels[request.scenario]}` : 'Ждём ответа'
    : request.status === 'accepted' ? 'Можно договориться о встрече' : 'Знакомство закрыто';
  const identity = (request: SocialRequestView) => <div className="gav-connection-identity">
    <div className="gav-connection-portrait"><CandidatePhoto src={request.otherDog?.avatarUrl || null} name={request.otherDog?.name || 'собаки'}/></div>
    <div><b>{request.otherDog?.name ?? 'Другая собака'}</b><p>{statusCopy(request)}</p></div>
  </div>;
  if (onSelect && !selectedId) {
    const groups = [
      { title: 'Вас зовут', items: requests.filter(r => r.status === 'pending' && r.recipientPetId === petId) },
      { title: 'Можно договариваться', items: requests.filter(r => r.status === 'accepted') },
      { title: 'Ждём ответа', items: requests.filter(r => r.status === 'pending' && r.senderPetId === petId) },
    ];
    const history = requests.filter(r => r.status !== 'pending' && r.status !== 'accepted');
    return <section className="gav-connections" aria-label="Отклики и связи"><h2>Ваша компания</h2>
      <p>Здесь продолжаются знакомства — от первого отклика до места прогулки.</p>
      {!groups.some(g => g.items.length) && <div className="gav-journey-empty"><PawPrint aria-hidden="true"/><h3>Сейчас нет активных откликов</h3><p>Выберите собаку или дайте свой Гав, чтобы найти компанию.</p><button type="button" className="woof-primary" onClick={onBack}>Вернуться к собакам</button></div>}
      {groups.filter(g => g.items.length).map(g => <section key={g.title}><h3>{g.title}</h3>{g.items.map(r => <button className="gav-connection-row" type="button" key={r.id} onClick={() => onSelect(r.id)}>{identity(r)}<span aria-hidden="true">→</span></button>)}</section>)}
      {!!history.length && <details className="gav-history"><summary>Завершённые знакомства · {history.length}</summary>{history.map(r => <button className="gav-connection-row" type="button" key={r.id} onClick={() => onSelect(r.id)}>{identity(r)}<span aria-hidden="true">→</span></button>)}</details>}
    </section>;
  }
  const visible = selectedId ? requests.filter(r => r.id === selectedId) : requests;
  if (!visible.length) return <section className="gav-journey-empty"><h2>Знакомство больше недоступно</h2><p>Возможно, участник закрыл его. Другие отклики остаются в списке.</p><button type="button" onClick={onBack}>К откликам</button></section>;
  return (
    <section className="social-requests-panel" aria-labelledby="social-requests-title">

      <h2 id="social-requests-title" className="sr-only">Знакомство</h2>
      <div className="social-request-list">
        {visible.map((request) => {
          const incoming = request.recipientPetId === petId;
          const busy = busyId === request.id;
          return (
            <article key={request.id} className="social-request-card">
              <header className="gav-relationship-heading">{onBack && <button className="gav-back" type="button" onClick={onBack}>← К откликам</button>}{identity(request)}</header>
              <p className="gav-connection-purpose">{request.source === 'signal' ? 'Отклик на Гав' : request.source === 'invite' ? 'По приглашению' : 'Знакомство по анкете'} · {scenarioLabels[request.scenario]}</p>
              {request.status === 'pending' && <p>{incoming ? 'Откликнитесь на приглашение. После согласия можно выбрать место и открыть контакт.' : 'Отклик отправлен. Ответ появится здесь автоматически; можно продолжить поиск компании.'}</p>}
              {request.status !== 'pending' && request.status !== 'accepted' && <p>Эта связь закрыта. Активные знакомства и новые отклики — в общем списке.</p>}
              {request.status === 'pending' && incoming && (
                <div className="social-request-actions">
                  <button className="primary" type="button" disabled={busy} onClick={() => onAction(request.id, 'accept')}>Принять</button>
                  <button type="button" disabled={busy} onClick={() => onAction(request.id, 'reject')}>Отклонить</button>
                </div>
              )}
              {request.status === 'pending' && !incoming && (
                <button type="button" disabled={busy} onClick={() => onAction(request.id, 'cancel')}>Отменить запрос</button>
              )}
              {request.status === 'accepted' && <div className="social-request-actions">
                {!children&&onMeeting&&<button type="button" onClick={()=>onMeeting(request.id)}>Место встречи</button>}
                {request.telegramContactUrl && <button className="primary" type="button" onClick={() => onOpenChat(request.telegramContactUrl!)}>Открыть чат</button>}

              </div>}
              {request.status === 'accepted' && !request.telegramContactUrl && <div className="gav-contact-unavailable"><p>{missingTelegramUsernameAction || 'Контакт участника пока недоступен. Вы можете предложить место здесь; чат появится, когда контакт станет доступен.'}</p><button type="button" onClick={onRefresh}>Проверить контакт</button></div>}
              {request.status === 'accepted' && children}
              {request.status !== 'blocked' && (
                <details className="gav-connection-more"><summary>Другие действия</summary><div className="social-safety-actions">
                  {request.status === 'accepted' && <button type="button" disabled={busy} onClick={() => setClosing(true)}>Завершить знакомство</button>}
                  <button type="button" disabled={busy} onClick={() => setBlockingId(request.id)}>Заблокировать</button>
                  <button type="button" disabled={busy} onClick={() => { setReportingId(request.id); setReason(''); }}>Пожаловаться</button>
                </div></details>
              )}
              {closing && <div className="gav-inline-confirm"><p>Завершить это знакомство? Оно останется в истории, но место и контакт больше не будут доступны.</p><button type="button" disabled={busy} onClick={async () => { if (await onAction(request.id, 'close')) setClosing(false); }}>Да, завершить</button><button type="button" onClick={() => setClosing(false)}>Продолжить знакомство</button></div>}

              {reportingId === request.id && (
                <form onSubmit={async (event) => {
                  event.preventDefault();
                  if (reason.trim().length < 3) return;
                  if (!await onReport(request.id, reason.trim())) return;
                  setReportingId(null);
                  setReason('');
                }}>
                  <label>
                    Что произошло
                    <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Коротко опиши проблему" />
                  </label>
                  <div className="social-request-actions">
                    <button className="primary" type="submit" disabled={busy || reason.trim().length < 3}>Отправить жалобу</button>
                    <button type="button" onClick={() => setReportingId(null)}>Отмена</button>
                  </div>
                </form>
              )}
              {blockingId === request.id && <div className="social-block-confirm" role="group" aria-label="Подтвердить блокировку">
                <p>Скрыть владельца и все его запросы? Это действие можно будет отменить только через поддержку.</p>
                <div className="social-request-actions">
                  <button type="button" disabled={busy} onClick={async () => { if (await onAction(request.id, 'block')) setBlockingId(null); }}>Заблокировать</button>
                  <button type="button" onClick={() => setBlockingId(null)}>Отмена</button>
                </div>
              </div>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
