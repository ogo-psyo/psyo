import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <section>
        <p className="eyebrow">Псё · черновик RC1</p>
        <h1>Конфиденциальность</h1>
        <p>Публичной становится только та часть карточки питомца, которую владелец явно выбирает для публикации. Точные адреса, Telegram ID, медицинские документы, лекарства и внутренние заметки не должны попадать в публичную карточку.</p>
        <div className="legal-callout">
          <b>Release gate</b>
          <p>Финальная политика обработки персональных данных должна быть утверждена до включения production billing и широкого привлечения пользователей.</p>
        </div>
        <Link href="/">Вернуться в Псё</Link>
      </section>
    </main>
  );
}
