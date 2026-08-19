'use client';

import type { ReactNode } from 'react';
import {
  BellSimple,
  CaretRight,
  ChartLineUp,
  FirstAid,
  Heartbeat,
  ListChecks,
  MapTrifold,
  Package,
  PawPrint,
  Sparkle,
  UsersThree,
} from '@phosphor-icons/react';

export type AllFunctionTarget = 'profile' | 'calendar' | 'map' | 'nearby' | 'things' | 'assistant';

type FunctionRow = {
  id: string;
  label: string;
  detail: string;
  value: string;
  target: AllFunctionTarget;
  icon: typeof PawPrint;
};

export function AllFunctionsHub({
  dogName,
  breedLabel,
  profileFacts,
  profileFactsTotal,
  activeReminders,
  observations,
  habits,
  places,
  nearby,
  things,
  avatar,
  reminderFeature,
  healthFeature,
  onNavigate,
}: {
  dogName: string;
  breedLabel: string;
  profileFacts: number;
  profileFactsTotal: number;
  activeReminders: number;
  observations: number;
  habits: number;
  places: number;
  nearby: number;
  things: number;
  avatar: ReactNode;
  reminderFeature: ReactNode;
  healthFeature: ReactNode;
  onNavigate: (target: AllFunctionTarget) => void;
}) {
  const rows: FunctionRow[] = [
    {
      id: 'habits',
      label: 'Привычки',
      detail: 'Ритм жизни и регулярный уход',
      value: habits ? `${habits} сохранено` : 'Настроить',
      target: 'profile',
      icon: ListChecks,
    },
    {
      id: 'map',
      label: 'Карта',
      detail: 'Маршруты, места и контекст прогулок',
      value: places ? `${places} мест` : 'Открыть',
      target: 'map',
      icon: MapTrifold,
    },
    {
      id: 'nearby',
      label: 'Рядом',
      detail: 'Подходящие знакомства и сервисы',
      value: nearby ? `${nearby} вариантов` : 'Посмотреть',
      target: 'nearby',
      icon: UsersThree,
    },
    {
      id: 'things',
      label: 'Вещи',
      detail: 'Корм, лекарства, амуниция и покупки',
      value: things ? `${things} нужно` : 'Добавить',
      target: 'things',
      icon: Package,
    },
    {
      id: 'assistant',
      label: 'Ассистент',
      detail: 'Работает с контекстом этой собаки',
      value: 'Спросить',
      target: 'assistant',
      icon: Sparkle,
    },
  ];

  return (
    <section className="all-functions-hub" aria-labelledby="all-functions-title">
      <header className="all-functions-heading">
        <div>
          <h2 id="all-functions-title">Всё про {dogName}</h2>
          <p>Каждая функция использует профиль выбранной собаки.</p>
        </div>
        <button className="all-dog-context" type="button" onClick={() => onNavigate('profile')} aria-label={`Открыть профиль ${dogName}`}>
          {avatar}
          <span><b>{dogName}</b><small>{breedLabel}</small></span>
          <CaretRight weight="bold" aria-hidden="true" />
        </button>
      </header>

      <div className="all-knowledge-band">
        <button type="button" onClick={() => onNavigate('profile')}>
          <span className="all-function-icon"><ChartLineUp weight="duotone" aria-hidden="true" /></span>
          <span><b>Сводка</b><small>Знания, которые Псё уже собрало</small></span>
          <strong>{profileFacts}/{profileFactsTotal}</strong>
          <CaretRight weight="bold" aria-hidden="true" />
        </button>
        <p>{profileFacts === profileFactsTotal ? 'Каркас профиля собран' : 'Дополняется по мере использования функций'}</p>
      </div>

      <section className="all-feature-module all-reminder-module" aria-labelledby="all-reminders-title">
        <button className="all-feature-module-heading" type="button" onClick={() => onNavigate('calendar')}>
          <span className="all-function-icon"><BellSimple weight="duotone" aria-hidden="true" /></span>
          <span><b id="all-reminders-title">Напоминания</b><small>Важные даты и повторяющиеся дела</small></span>
          <strong>{activeReminders || '—'}</strong>
          <CaretRight weight="bold" aria-hidden="true" />
        </button>
        {reminderFeature}
      </section>

      <section className="all-feature-module all-health-module" aria-labelledby="all-health-title">
        <button className="all-feature-module-heading" type="button" onClick={() => onNavigate('profile')}>
          <span className="all-function-icon"><Heartbeat weight="duotone" aria-hidden="true" /></span>
          <span><b id="all-health-title">Здоровье</b><small>Наблюдения, история и документы</small></span>
          <strong>{observations || '—'}</strong>
          <CaretRight weight="bold" aria-hidden="true" />
        </button>
        {healthFeature}
      </section>

      <nav className="all-function-directory" aria-label="Все функции Псё">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <button key={row.id} type="button" onClick={() => onNavigate(row.target)}>
              <span className="all-function-icon"><Icon weight="duotone" aria-hidden="true" /></span>
              <span><b>{row.label}</b><small>{row.detail}</small></span>
              <strong>{row.value}</strong>
              <CaretRight weight="bold" aria-hidden="true" />
            </button>
          );
        })}
      </nav>

      <p className="all-function-footnote"><FirstAid weight="duotone" aria-hidden="true" /> Профиль остаётся источником контекста, а не тестом на заполненность.</p>
    </section>
  );
}
