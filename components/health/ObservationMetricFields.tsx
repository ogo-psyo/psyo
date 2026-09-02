'use client';

export const observationMetricDefinitions = [
  { key: 'mood', label: 'Настроение', options: ['спокойное', 'радостное', 'тревожное', 'вялое'] },
  { key: 'appetite', label: 'Аппетит', options: ['обычный', 'ниже обычного', 'выше обычного', 'не ела'] },
  { key: 'stool', label: 'Пищеварение', options: ['обычный', 'мягкий', 'твёрдый', 'не было'] },
  { key: 'energy', label: 'Энергия', options: ['обычная', 'ниже обычного', 'выше обычного', 'нет сил'] },
] as const;

export type ObservationMetricKey = typeof observationMetricDefinitions[number]['key'];
export type ObservationMetricValues = Partial<Record<ObservationMetricKey, string>>;

export function observationMetricCount(values: ObservationMetricValues) {
  return observationMetricDefinitions.filter(({ key }) => Boolean(values[key]?.trim())).length;
}

export function ObservationMetricFields({
  values,
  onChange,
  compact = false,
}: {
  values: ObservationMetricValues;
  onChange: (patch: Partial<Record<ObservationMetricKey, string>>) => void;
  compact?: boolean;
}) {
  return <div className={`health-metric-fields${compact ? ' is-compact' : ''}`} data-observation-metrics>
    {observationMetricDefinitions.map(({ key, label, options }) => {
      const value = values[key] || '';
      const customValue = value && !(options as readonly string[]).includes(value) ? value : '';
      return <fieldset className="health-choice" key={key}>
        <legend>{label}</legend>
        {customValue && <p className="health-choice-current">Сейчас: <b>{customValue}</b></p>}
        <div>{options.map((option) => <button key={option} type="button" className={value === option ? 'active' : ''} aria-pressed={value === option} onClick={() => onChange({ [key]: value === option ? '' : option })}>{option}</button>)}</div>
      </fieldset>;
    })}
  </div>;
}
