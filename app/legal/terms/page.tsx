import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="legal-page">
      <section>
        <p className="eyebrow">Псё</p>
        <h1>Условия</h1>
        <p>Псё помогает помнить уход за собакой и общаться с другими владельцами, но не заменяет ветеринара, кинолога или экстренную помощь.</p>
        <div className="legal-callout">
          <b>Закрытое тестирование</b>
          <p>Оплата пока недоступна. Возможности приложения могут меняться по итогам обратной связи первых пользователей.</p>
        </div>
        <Link href="/">Вернуться в Псё</Link>
      </section>
    </main>
  );
}
