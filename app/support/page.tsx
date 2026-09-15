import { ExactPublicLayout } from '@/components/exact/ExactPublicLayout';
import Link from 'next/link';

export default function SupportPage() {
  return (
    <ExactPublicLayout>
      <section>
        <p className="eyebrow">Псё</p>
        <h1>Поддержка</h1>
        <p>Если дело, памятка или поиск рядом работают не так, напишите в чат Telegram, из которого вы открыли Псё. Не отправляйте медицинские документы и другие чувствительные сведения в открытом чате.</p>
        <div className="legal-callout">
          <b>Контакт</b>
          <p>Чат с Псё в Telegram</p>
        </div>
        <Link href="/">Вернуться в Псё</Link>
      </section>
    </ExactPublicLayout>
  );
}
