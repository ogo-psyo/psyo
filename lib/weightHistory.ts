export type WeightObservationInput = {
  id: string;
  type?: string;
  value?: unknown;
  note?: string;
  observedAt?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

export type WeightMeasurement = {
  id: string;
  valueKg: number;
  observedAt: string;
  note?: string;
};

export function parseWeightKg(value: unknown) {
  const match = String(value ?? '').trim().replace(',', '.').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 200 ? parsed : null;
}

export function buildWeightHistory(observations: WeightObservationInput[]) {
  const measurements: WeightMeasurement[] = [];
  for (const observation of observations) {
    if (observation.type !== 'weight') continue;
    const valueKg = parseWeightKg(observation.value ?? observation.metadata?.valueKg);
    const observedAt = String(observation.observedAt || observation.createdAt || '');
    const timestamp = Date.parse(observedAt);
    if (valueKg === null || !Number.isFinite(timestamp)) continue;
    measurements.push({
      id: observation.id,
      valueKg,
      observedAt: new Date(timestamp).toISOString(),
      note: observation.note,
    });
  }
  return measurements.sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt));
}

export function formatProfileDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}
