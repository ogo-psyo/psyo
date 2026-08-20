'use client';

import { useState } from 'react';
import type { SocialScenario } from '@/lib/socialCore';

export type SocialRequestView = {
  id: string;
  senderPetId: string;
  recipientPetId: string;
  scenario: SocialScenario;
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

const statusLabels: Record<SocialRequestView['status'], string> = {
  pending: 'ждёт решения',
  accepted: 'вы согласились',
  rejected: 'отклонён',
  cancelled: 'отменён',
  blocked: 'пользователь заблокирован',
};

export function RequestsPanel({
  petId,
  requests,
  busyId,
  missingTelegramUsernameAction,
  onAction,
  onReport,
  onOpenChat,
}: {
  petId: string;
  requests: SocialRequestView[];
  busyId: string | null;
  missingTelegramUsernameAction: string | null;
  onAction: (id: string, action: 'accept' | 'reject' | 'cancel' | 'block') => void;
  onReport: (id: string, reason: string) => void;
  onOpenChat: (url: string) => void;
}) {
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  if (requests.length === 0) return null;

  return (
    <section className="social-requests-panel" aria-labelledby="social-requests-title">
      <div className="social-section-heading">
        <div>
          <h3 id="social-requests-title">Запросы</h3>
          <p>Контакт откроется только после взаимного согласия.</p>
        </div>
      </div>
      <div className="social-request-list">
        {requests.map((request) => {
          const incoming = request.recipientPetId === petId;
          const busy = busyId === request.id;
          return (
            <article key={request.id} className="social-request-card">
              <div>
                <b>{request.otherDog?.name ?? 'Другая собака'}</b>
                <p>{incoming ? `Вас зовут на ${scenarioLabels[request.scenario]}` : `Ваш запрос на ${scenarioLabels[request.scenario]}`}</p>
                <p>{statusLabels[request.status]}</p>
              </div>

              {request.status === 'pending' && incoming && (
                <div className="social-request-actions">
                  <button className="primary" type="button" disabled={busy} onClick={() => onAction(request.id, 'accept')}>Принять</button>
                  <button type="button" disabled={busy} onClick={() => onAction(request.id, 'reject')}>Отклонить</button>
                </div>
              )}
              {request.status === 'pending' && !incoming && (
                <button type="button" disabled={busy} onClick={() => onAction(request.id, 'cancel')}>Отменить запрос</button>
              )}
              {request.status === 'accepted' && request.telegramContactUrl && (
                <button className="primary" type="button" onClick={() => onOpenChat(request.telegramContactUrl!)}>Открыть чат</button>
              )}
              {request.status === 'accepted' && !request.telegramContactUrl && missingTelegramUsernameAction && (
                <p className="social-inline-hint">{missingTelegramUsernameAction}</p>
              )}

              {request.status !== 'blocked' && (
                <div className="social-safety-actions">
                  <button type="button" disabled={busy} onClick={() => setBlockingId(request.id)}>Заблокировать</button>
                  <button type="button" disabled={busy} onClick={() => { setReportingId(request.id); setReason(''); }}>Пожаловаться</button>
                </div>
              )}

              {reportingId === request.id && (
                <form onSubmit={(event) => {
                  event.preventDefault();
                  if (reason.trim().length < 3) return;
                  onReport(request.id, reason.trim());
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
              {blockingId === request.id && <div className="social-block-confirm" role="dialog" aria-modal="true" aria-label="Подтвердить блокировку">
                <p>Скрыть владельца и все его запросы? Это действие можно будет отменить только через поддержку.</p>
                <div className="social-request-actions">
                  <button type="button" disabled={busy} onClick={() => { setBlockingId(null); onAction(request.id, 'block'); }}>Заблокировать</button>
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
