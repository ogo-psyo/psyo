import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="legal-page">
      <section>
        <p className="eyebrow">Псё · черновик RC1</p>
        <h1>Условия</h1>
        <p>Псё помогает помнить уход за собакой, но не заменяет ветеринара, кинолога или экстренную помощь. Подписка Псё Плюс через Telegram Stars не включается в production без утверждённых условий оплаты, возврата и поддержки.</p>
        <div className="legal-callout">
          <b>Платежи</b>
          <p>Production invoices отключены feature flag до подтверждения цены, юридических текстов и smoke-теста Telegram Stars.</p>
        </div>
        <Link href="/">Вернуться в Псё</Link>
      </section>
    </main>
  );
}
