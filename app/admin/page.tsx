'use client';

import { useMemo, useState } from 'react';

type AdminOwner = {
  psyoUserId: string;
  ownerId: string;
  profile?: { email?: string | null; display_name?: string | null } | null;
  subscription?: { tier?: string | null; status?: string | null; expires_at?: string | null; provider?: string | null } | null;
  pets?: { id: string; name: string }[];
  updatedAt: string;
};

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [owners, setOwners] = useState<AdminOwner[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');

  const activeOwners = useMemo(() => owners.filter((owner) => owner.subscription?.status === 'active').length, [owners]);

  async function loadOwners() {
    if (!token.trim()) {
      setError('Нужен PSYO_ADMIN_TOKEN.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setError('');
    const response = await fetch('/api/admin/auth/owners', {
      headers: { 'x-psyo-admin-token': token.trim() },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setOwners([]);
      setStatus('error');
      setError(payload?.error || 'Админка авторизации недоступна.');
      return;
    }

    setOwners(Array.isArray(payload?.owners) ? payload.owners : []);
    setStatus('ready');
  }

  return (
    <main className="admin-shell">
      <section className="admin-panel admin-hero">
        <div>
          <p>PSYO admin</p>
          <h1>Авторизация и доступ</h1>
          <span>{'Telegram initData -> HttpOnly session -> owner -> Plus'}</span>
        </div>
        <div className="admin-token-box">
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="PSYO_ADMIN_TOKEN"
            aria-label="PSYO admin token"
          />
          <button type="button" onClick={loadOwners} disabled={status === 'loading'}>{status === 'loading' ? 'Загрузка...' : 'Открыть'}</button>
        </div>
      </section>

      <section className="admin-stats" aria-label="Сводка авторизации">
        <article><b>{owners.length}</b><span>Telegram owners</span></article>
        <article><b>{activeOwners}</b><span>Active Plus</span></article>
        <article><b>{owners.reduce((total, owner) => total + (owner.pets?.length ?? 0), 0)}</b><span>Dogs</span></article>
      </section>

      {error && <section className="admin-panel admin-error" role="alert">{error}</section>}

      <section className="admin-panel">
        <div className="admin-table-head">
          <div>Telegram identity</div>
          <div>Owner</div>
          <div>Dogs</div>
          <div>Access</div>
        </div>
        {owners.length === 0 ? <p className="admin-empty">После ввода токена здесь будут Telegram-привязки, профили и подписки.</p> : owners.map((owner) => (
          <article className="admin-owner-row" key={owner.psyoUserId}>
            <div>
              <b>{owner.psyoUserId}</b>
              <span>{new Date(owner.updatedAt).toLocaleString('ru-RU')}</span>
            </div>
            <div>
              <b>{owner.profile?.display_name || 'Owner'}</b>
              <span>{owner.ownerId}</span>
            </div>
            <div>
              <b>{owner.pets?.map((pet) => pet.name).join(', ') || 'нет собак'}</b>
              <span>{owner.pets?.length ?? 0} проф.</span>
            </div>
            <div>
              <b>{owner.subscription?.tier || 'free'} · {owner.subscription?.status || 'inactive'}</b>
              <span>{owner.subscription?.expires_at ? `до ${new Date(owner.subscription.expires_at).toLocaleDateString('ru-RU')}` : owner.subscription?.provider || 'без подписки'}</span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
