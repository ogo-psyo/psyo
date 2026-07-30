'use client';

export function DesktopContextPanel({
  dogName,
  nearestTitle,
  nearestCaption,
  nearestAction,
  activeCount,
  completedCount,
  cardReady,
  onNearestAction,
  onOpenPlan,
  onOpenHistory,
  onOpenCard,
}: {
  dogName: string;
  nearestTitle: string;
  nearestCaption: string;
  nearestAction: string;
  activeCount: number;
  completedCount: number;
  cardReady: boolean;
  onNearestAction: () => void;
  onOpenPlan: () => void;
  onOpenHistory: () => void;
  onOpenCard: () => void;
}) {
  return (
    <aside className="desktop-context-panel" aria-label={`Сводка ухода ${dogName}`}>
      <div className="desktop-context-heading">
        <span>сводка</span>
        <b>{dogName}</b>
      </div>

      <section>
        <span>Ближайшее дело</span>
        <b>{nearestTitle}</b>
        <p>{nearestCaption}</p>
        <button className="primary" type="button" onClick={onNearestAction}>{nearestAction}</button>
      </section>

      <section>
        <span>История ухода</span>
        <b>{activeCount ? `${activeCount} в плане` : 'План свободен'}</b>
        <p>{completedCount ? `${completedCount} выполнено и сохранено в истории.` : 'История появится после первого выполненного дела.'}</p>
        <div>
          <button type="button" onClick={onOpenPlan}>Открыть план</button>
          <button type="button" onClick={onOpenHistory}>История</button>
        </div>
      </section>

      <section>
        <span>Памятка</span>
        <b>{cardReady ? 'Можно показывать' : 'Нужно дозаполнить'}</b>
        <p>{cardReady ? 'Короткая безопасная карточка готова для другого человека.' : 'Добавь недостающие данные перед передачей собаки.'}</p>
        <button type="button" onClick={onOpenCard}>{cardReady ? 'Проверить' : 'Дозаполнить'}</button>
      </section>
    </aside>
  );
}
