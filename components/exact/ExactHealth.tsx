'use client';

import type { DogProfile } from '@/lib/data';
import type { WeightMeasurement } from '@/lib/weightHistory';
import { WeightHistoryCard } from '@/components/profile/WeightHistoryCard';
import { ExactPage, ExactRow } from './ExactShell';

function shown(value?: string, fallback = 'Не указано') {
  return value?.trim() || fallback;
}

export function ExactHealth(props: {
  profile: DogProfile;
  measurements: WeightMeasurement[];
  onAddWeight: (measurement: { valueKg: number; date: string }) => Promise<void>;
  onObserve: () => void;
  onHistory: () => void;
  onCare: () => void;
  onEditProfile: () => void;
  onBack: () => void;
}) {
  return <ExactPage viewKey="health" onBack={props.onBack}>
    <div data-health-workspace>
    <h1>Здоровье</h1>
    <p className="lead">Самочувствие, важные сведения и динамика {props.profile.dogName}.</p>

    <WeightHistoryCard measurements={props.measurements} onAdd={props.onAddWeight} />

    <section className="soft section-gap exact-health-facts" data-health-facts aria-labelledby="health-facts-title">
      <div className="section-title"><div><span className="eyebrow">постоянные данные</span><h2 id="health-facts-title">Что важно помнить</h2></div></div>
      <dl>
        <div><dt>Аллергии</dt><dd>{shown(props.profile.allergies)}</dd></div>
        <div><dt>Лекарства</dt><dd>{shown(props.profile.medication)}</dd></div>
        <div><dt>Клиника</dt><dd>{shown(props.profile.vetClinic)}</dd></div>
        <div><dt>Вакцинация</dt><dd>{shown(props.profile.vaccineStatus)}</dd></div>
        <div><dt>Обработка</dt><dd>{shown(props.profile.parasiteStatus)}</dd></div>
      </dl>
      {props.profile.healthNotes && <p>{props.profile.healthNotes}</p>}
      <button type="button" className="text-button" onClick={props.onEditProfile}>Изменить сведения</button>
    </section>

    <div className="list section-gap">
      <ExactRow title="Добавить наблюдение" detail="Аппетит, энергия, симптомы или заметка" icon="plus" onClick={props.onObserve} />
      <ExactRow title="История здоровья" detail="Записи по дням в общем календаре" icon="book" onClick={props.onHistory} />
      <ExactRow title="План заботы" detail="Приёмы, процедуры и напоминания" icon="clock" onClick={props.onCare} />
    </div>
    </div>
  </ExactPage>;
}
