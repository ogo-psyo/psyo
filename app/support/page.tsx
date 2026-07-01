import Link from 'next/link';
import { rc1Config } from '@/lib/rc1';

export default function SupportPage() {
  return (
    <main className="legal-page">
      <section>
        <p className="eyebrow">Псё</p>
        <h1>Поддержка</h1>
        <p>Если напоминание, карточка питомца или оплата работают не так, напишите в поддержку. Не отправляйте медицинские документы, токены или приватные данные в открытом чате.</p>
        <div className="legal-callout">
          <b>Контакт</b>
          <p>{rc1Config.supportContact === 'TBD' ? 'Контакт поддержки ещё не утверждён для RC1.' : rc1Config.supportContact}</p>
        </div>
        <Link href="/">Вернуться в Псё</Link>
      </section>
    </main>
  );
}
