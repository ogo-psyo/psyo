export type WellbeingMetric = 'mood' | 'appetite' | 'stool' | 'energy';

export function wellbeingValue(metric: WellbeingMetric, raw?: string): number | null {
  const value = raw?.trim().toLocaleLowerCase('ru-RU');
  if (!value) return null;
  if (metric === 'mood') {
    if (/радост|довольн|хорош(?:ее|ем) настроен/.test(value)) return 4;
    if (value.includes('спокой')) return 3;
    if (value.includes('тревож')) return 2;
    if (value.includes('вял')) return 1;
  }
  if (metric === 'appetite') {
    if (/не ел|не ела|отказ/.test(value)) return 1;
    if (/меньше|хуже|ниже/.test(value)) return 2;
    if (/обыч|хорош|с аппетитом|активно поел|активно поела/.test(value)) return 3;
    if (/выше|больше/.test(value)) return 2.5;
  }
  if (metric === 'stool') {
    if (value.includes('жид')) return 1;
    if (/мяг|не был|не было/.test(value)) return 2;
    if (value.includes('обыч')) return 3;
  }
  if (metric === 'energy') {
    if (/спит больше|больше спит|менее актив|вял|сонн|нет сил|быстро уста/.test(value)) return 1;
    if (/мало|ниже/.test(value)) return 2;
    if (/бодр|энергич|как обыч|обычная|обычный|обычное/.test(value)) return 3;
    if (/слишком актив|много/.test(value)) return 2.5;
  }
  return 2.5;
}
