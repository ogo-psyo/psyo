'use client';

import { CalendarCheck, FirstAid, ListChecks, MapTrifold, ShoppingBag } from '@phosphor-icons/react';
import type { Recommendation } from '@/packages/recommendations/contracts';
import { recommendationActionLabel } from '@/lib/recommendations/client';
import styles from './RecommendationCard.module.css';

type Props = {
  dogName: string;
  recommendation: Recommendation | null;
  state: 'idle' | 'loading' | 'ready' | 'error';
  busyAction: 'primary' | 'snooze' | 'dismiss' | null;
  onPrimary: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
  onRetry: () => void;
};

function CategoryIcon({ category }: { category: Recommendation['category'] }) {
  if (category === 'care') return <CalendarCheck weight="duotone" aria-hidden="true" />;
  if (category === 'wellbeing') return <FirstAid weight="duotone" aria-hidden="true" />;
  if (category === 'habit') return <ListChecks weight="duotone" aria-hidden="true" />;
  if (category === 'walk') return <MapTrifold weight="duotone" aria-hidden="true" />;
  return <ShoppingBag weight="duotone" aria-hidden="true" />;
}

export function RecommendationCard(props: Props) {
  if (props.state === 'loading') {
    return <div className={`${styles.shell} ${styles.loading}`} role="status">Подбираю следующий полезный шаг…</div>;
  }
  if (props.state === 'error') {
    return <div className={styles.shell} role="status"><span>Совет пока не обновился. Остальные функции работают.</span><button className={styles.retry} type="button" onClick={props.onRetry}>Повторить</button></div>;
  }
  if (!props.recommendation) return null;

  const accepted = props.recommendation.status === 'accepted';
  const busy = props.busyAction !== null;
  return <section className={styles.card} data-recommendation-card data-category={props.recommendation.category} data-status={props.recommendation.status} aria-labelledby="recommendation-title">
    <div className={styles.heading}>
      <span className={styles.icon}><CategoryIcon category={props.recommendation.category} /></span>
      <div><h2 id="recommendation-title">{props.recommendation.title}</h2><p>{accepted ? `Следующий шаг для ${props.dogName} уже выбран.` : `Один полезный шаг для ${props.dogName} прямо сейчас.`}</p></div>
    </div>
    <ul className={styles.reasons} aria-label="Почему этот совет появился сейчас">
      {props.recommendation.whyNow.map((reason) => <li key={reason}>{reason}</li>)}
    </ul>
    {props.recommendation.limitation && <p className={styles.limitation}>{props.recommendation.limitation}</p>}
    <div className={styles.actions}>
      <button type="button" disabled={busy} onClick={props.onPrimary}>{props.busyAction === 'primary' ? 'Открываю…' : accepted ? 'Продолжить' : recommendationActionLabel(props.recommendation.primaryAction)}</button>
      <button type="button" disabled={busy || accepted} onClick={props.onSnooze}>{props.busyAction === 'snooze' ? 'Откладываю…' : 'На завтра'}</button>
      <button type="button" disabled={busy || accepted} onClick={props.onDismiss}>{props.busyAction === 'dismiss' ? 'Скрываю…' : 'Скрыть'}</button>
    </div>
    <p className={styles.status} aria-live="polite">{accepted ? 'Совет принят. Результат сохранится после выполненного действия.' : 'Можно принять, отложить или скрыть. Решение всегда за вами.'}</p>
  </section>;
}
