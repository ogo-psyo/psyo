'use client';

import type { ReactNode } from 'react';
import { ArrowRight, FilePdf, MapPin, PawPrint, Sparkle, UsersThree } from '@phosphor-icons/react';

export type AllFunctionTarget = 'profile' | 'calendar' | 'habits' | 'health' | 'map' | 'nearby' | 'things' | 'assistant';
export type DogModuleSummary = {
  status: 'empty' | 'active' | 'attention';
  reminders: { active: number; overdue: number; nextDueAt: string | null };
  habits: { active: number; completedToday: number; targetToday: number };
  health: { entries: number; lastAt: string | null };
  map: { places: number };
  things: { wanted: number };
};

export function AllFunctionsHub({
  dogName, breedLabel, summary, activeReminders, observations, documents, places, nearby, avatar,
  reminderFeature, healthFeature, onNavigate,
}: {
  dogName: string; dogNameAccusative: string; breedLabel: string; summary?: DogModuleSummary | null;
  activeReminders: number; observations: number; documents: number; habits: number; places: number; nearby: number; things: number;
  avatar: ReactNode; reminderFeature: ReactNode; healthFeature: ReactNode; onNavigate: (target: AllFunctionTarget) => void;
}) {
  const hasCare = Boolean(summary?.reminders.active || activeReminders);
  return <section className="living-day" aria-labelledby="living-day-title">
    <header className="living-day-hero">
      <button type="button" className="living-dog" onClick={() => onNavigate('profile')} aria-label={`Открыть профиль ${dogName}`}>
        {avatar}<span><small>сегодня с тобой</small><h2 id="living-day-title">{dogName}</h2><p>{breedLabel}</p></span><PawPrint weight="fill" aria-hidden="true" />
      </button>
      <div className="living-greeting"><Sparkle weight="fill" aria-hidden="true" /><p>{hasCare ? 'Одно важное — и день свободнее.' : 'Сегодня всё спокойно. Можно придумать прогулку.'}</p></div>
    </header>

    <section className="living-primary" aria-labelledby="living-care-title">
      <div className="living-section-heading"><div><small>важное сейчас</small><h3 id="living-care-title">{summary?.reminders.overdue ? 'Нужно внимание' : hasCare ? 'Следующее дело' : 'Сегодня всё сделано'}</h3></div><button type="button" onClick={() => onNavigate('calendar')}>Весь план <ArrowRight weight="bold" /></button></div>
      {reminderFeature}
    </section>

    <section className="living-discovery" aria-labelledby="living-nearby-title">
      <div className="living-section-heading"><div><small>может порадовать</small><h3 id="living-nearby-title">Что происходит рядом</h3></div></div>
      <div className="living-discovery-grid">
        <button type="button" onClick={() => onNavigate('nearby')}><UsersThree weight="duotone" /><span><b>{nearby ? `${nearby} собак готовы знакомиться` : 'Дать Гав'}</b><small>{nearby ? 'Посмотреть, кто зовёт гулять' : 'Позвать компанию на прогулку'}</small></span><ArrowRight weight="bold" /></button>
        <button type="button" onClick={() => onNavigate('map')}><MapPin weight="duotone" /><span><b>{places ? `${places} отметок на вашей карте` : 'Открыть карту прогулок'}</b><small>Маршруты, места и опасные зоны</small></span><ArrowRight weight="bold" /></button>
      </div>
    </section>

    <section className="living-trail" aria-labelledby="living-trail-title">
      <div className="living-section-heading"><div><small>след жизни</small><h3 id="living-trail-title">История {dogName}</h3></div><button type="button" onClick={() => onNavigate('profile')}>Открыть <ArrowRight weight="bold" /></button></div>
      <div className="living-trail-grid">
        <button type="button" onClick={() => onNavigate('profile')}><FilePdf weight="duotone" /><b>{documents ? `${documents} документов` : 'Добавить анализ'}</b><small>Из клиники — в личную историю</small></button>
        <div className="living-health">{healthFeature}<small>{observations ? 'Записано владельцем' : 'Без автоматических «норм»'}</small></div>
      </div>
    </section>

    <nav className="living-quick-actions" aria-label="Быстрые действия">
      <button type="button" onClick={() => onNavigate('profile')}>Добавить анализ</button>
      <button type="button" onClick={() => onNavigate('health')}>Что заметили?</button>
      <button type="button" onClick={() => onNavigate('nearby')}>Дать Гав</button>
      <button type="button" onClick={() => onNavigate('map')}>Отметить место</button>
    </nav>
  </section>;
}
