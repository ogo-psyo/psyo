import { ArrowRight, CalendarCheck, ChatCircleDots, PawPrint, ShieldCheck } from '@phosphor-icons/react';
import styles from './FirstRunWelcome.module.css';

export function FirstRunWelcome({ onStart }: { onStart: () => void }) {
  return <section className={styles.welcome} aria-labelledby="first-run-title">
    <header><span aria-hidden="true"><PawPrint weight="fill" /></span><b>Псё</b></header>
    <div className={styles.hero}>
      <p>Персональный помощник владельца собаки</p>
      <h1 id="first-run-title">Вся жизнь<br />с собакой —<br /><em>в порядке.</em></h1>
      <p className={styles.lead}>Здоровье, уход, прогулки и важные мелочи — в одном спокойном месте.</p>
      <div className={styles.orbit} aria-hidden="true"><span /><span /><PawPrint weight="duotone" /></div>
    </div>
    <div className={styles.valueList} aria-label="Возможности Псё">
      <span><CalendarCheck weight="duotone" /><span><b>Помнит дела</b><small>и вовремя напоминает</small></span></span>
      <span><ChatCircleDots weight="duotone" /><span><b>Знает контекст</b><small>отвечает именно о вашей собаке</small></span></span>
      <span><ShieldCheck weight="duotone" /><span><b>Бережёт личное</b><small>вы сами решаете, чем делиться</small></span></span>
    </div>
    <button type="button" onClick={onStart}><span>Добавить собаку</span><ArrowRight weight="bold" /></button>
    <small>Имени достаточно, чтобы начать · меньше минуты</small>
  </section>;
}
