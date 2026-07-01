'use client';

import { useState } from 'react';

export function DogCardActions({ name }: { name: string }) {
  const [status, setStatus] = useState('');

  async function share() {
    const url = window.location.href;
    const title = `Памятка по собаке ${name}`;
    if (navigator.share) {
      await navigator.share({ title, url }).then(() => setStatus('Открываю отправку')).catch(() => null);
      return;
    }
    const copied = await navigator.clipboard?.writeText(url).then(() => true).catch(() => false);
    setStatus(copied ? 'Ссылка скопирована' : 'Не удалось скопировать ссылку');
  }

  return (
    <>
      <div className="share-action-row">
        <button className="primary" onClick={share}>Поделиться</button>
        <button className="secondary" onClick={() => window.print()}>PDF / печать</button>
      </div>
      <p className="privacy-hint">Отправляй тем, кто гуляет, сидит с собакой, ведёт на груминг или может встретить её во дворе.</p>
      {status && <p className="share-status" role="status">{status}</p>}
    </>
  );
}
