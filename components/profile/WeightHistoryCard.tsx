'use client';

import { FormEvent, useMemo, useState } from 'react';
import type { WeightMeasurement } from '@/lib/weightHistory';

type NewWeightMeasurement = { valueKg: number; date: string };

type WeightHistoryCardProps = {
  measurements: WeightMeasurement[];
  onAdd?: (measurement: NewWeightMeasurement) => Promise<void>;
};

const chart = { width: 320, height: 174, left: 30, right: 8, top: 22, bottom: 24 };

function localDateInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatWeight(value: number) {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: value % 1 ? 1 : 0, maximumFractionDigits: 2 });
}

function formatDate(value: string, month: 'short' | 'long' = 'long') {
  return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month });
}

export function WeightHistoryCard({ measurements, onAdd }: WeightHistoryCardProps) {
  const latest = measurements.at(-1);
  const previous = measurements.at(-2);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(localDateInputValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selected = measurements.find((item) => item.id === selectedId) ?? latest;
  const plot = useMemo(() => {
    if (!measurements.length) return null;
    const timestamps = measurements.map((item) => Date.parse(item.observedAt));
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const rawMin = Math.min(...measurements.map((item) => item.valueKg));
    const rawMax = Math.max(...measurements.map((item) => item.valueKg));
    const padding = Math.max((rawMax - rawMin) * 0.16, 0.75);
    const minWeight = Math.max(0, rawMin - padding);
    const maxWeight = rawMax + padding;
    const plotWidth = chart.width - chart.left - chart.right;
    const plotHeight = chart.height - chart.top - chart.bottom;
    const x = (time: number) => chart.left + (maxTime === minTime ? .5 : (time - minTime) / (maxTime - minTime)) * plotWidth;
    const y = (value: number) => chart.top + (1 - (value - minWeight) / (maxWeight - minWeight)) * plotHeight;
    const points = measurements.map((item) => ({ ...item, x: x(Date.parse(item.observedAt)), y: y(item.valueKg) }));
    const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
    const gridValues = [minWeight, (minWeight + maxWeight) / 2, maxWeight];
    return { points, path, gridValues, y };
  }, [measurements]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onAdd || saving) return;
    const valueKg = Number(weight.replace(',', '.'));
    if (!Number.isFinite(valueKg) || valueKg <= 0 || valueKg >= 200) {
      setError('Укажи вес от 0 до 200 кг.');
      return;
    }
    if (!date) {
      setError('Укажи дату замера.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onAdd({ valueKg, date });
      setWeight('');
      setFormOpen(false);
    } catch {
      setError('Не удалось сохранить замер. Проверь связь и попробуй снова.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="weight-history-card" aria-labelledby="weight-history-title">
      <div className="weight-history-head">
        <div>
          <span className="eyebrow">динамика</span>
          <h3 id="weight-history-title">Вес</h3>
          {latest ? <p><b>{formatWeight(latest.valueKg)} кг</b> · {formatDate(latest.observedAt)}</p> : <p>Замеров пока нет</p>}
        </div>
        {latest && previous ? <span className="weight-history-delta">{latest.valueKg - previous.valueKg >= 0 ? '+' : ''}{formatWeight(latest.valueKg - previous.valueKg)} кг</span> : null}
      </div>

      {plot ? <>
        <div className="weight-chart" aria-label={`История веса: ${measurements.length} замеров`}>
          <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-labelledby="weight-chart-title weight-chart-description">
            <title id="weight-chart-title">Динамика веса</title>
            <desc id="weight-chart-description">{measurements.length} замеров от {formatWeight(measurements[0].valueKg)} до {formatWeight(latest?.valueKg ?? measurements[0].valueKg)} килограммов.</desc>
            {plot.gridValues.map((value) => <g key={value}>
              <line x1={chart.left} y1={plot.y(value)} x2={chart.width - chart.right} y2={plot.y(value)} />
              <text x={chart.left - 6} y={plot.y(value) + 4} textAnchor="end">{formatWeight(value)}</text>
            </g>)}
            <path className="weight-chart-line" d={plot.path} />
            {plot.points.map((point) => <circle key={point.id} cx={point.x} cy={point.y} r="4" />)}
          </svg>
          <div className="weight-chart-points">
            {plot.points.map((point) => <button
              key={point.id}
              type="button"
              aria-label={`${formatDate(point.observedAt)}, ${formatWeight(point.valueKg)} килограмма`}
              aria-pressed={selected?.id === point.id}
              style={{ left: `${point.x / chart.width * 100}%`, top: `${point.y / chart.height * 100}%` }}
              onClick={() => setSelectedId(point.id)}
            />)}
          </div>
          {selected ? <output className="weight-chart-reading">{formatDate(selected.observedAt)} · {formatWeight(selected.valueKg)} кг</output> : null}
          <div className="weight-chart-dates" aria-hidden="true">
            <span>{formatDate(measurements[0].observedAt, 'short')}</span>
            {measurements.length > 2 ? <span>{formatDate(measurements[Math.floor((measurements.length - 1) / 2)].observedAt, 'short')}</span> : null}
            <span>{formatDate(measurements[measurements.length - 1].observedAt, 'short')}</span>
          </div>
        </div>
      </> : <div className="weight-history-empty"><b>Добавь первый замер</b><p>Дата и вес помогут увидеть динамику, а не одно число.</p></div>}

      {formOpen ? <form className="weight-history-form" onSubmit={submit}>
        <label>Вес, кг<input inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="14,8" autoFocus /></label>
        <label>Дата<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        {error ? <p role="alert">{error}</p> : null}
        <div><button type="button" className="secondary" onClick={() => { setFormOpen(false); setError(''); }}>Отмена</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Сохраняю…' : 'Сохранить'}</button></div>
      </form> : onAdd ? <button type="button" className="primary full weight-history-add" onClick={() => setFormOpen(true)}>Добавить замер</button> : null}

      {measurements.length ? <button type="button" className="weight-history-toggle" aria-expanded={historyOpen} onClick={() => setHistoryOpen((current) => !current)}>{historyOpen ? 'Скрыть историю' : `Все ${measurements.length} замеров`}</button> : null}
      {historyOpen ? <ol className="weight-history-list">
        {[...measurements].reverse().map((item) => <li key={item.id}><time dateTime={item.observedAt}>{formatDate(item.observedAt)}</time><b>{formatWeight(item.valueKg)} кг</b></li>)}
      </ol> : null}
    </section>
  );
}
