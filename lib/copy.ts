import type { ReadinessLevel } from './readiness';

type CaseName = 'nomn' | 'gent' | 'datv' | 'ablt';

const irregularPetNames: Record<string, Record<CaseName, string>> = {
  Марс: { nomn: 'Марс', gent: 'Марса', datv: 'Марсу', ablt: 'Марсом' },
  Мята: { nomn: 'Мята', gent: 'Мяты', datv: 'Мяте', ablt: 'Мятой' },
};

export function inflectPetName(name: string, targetCase: CaseName = 'nomn') {
  const clean = name.trim();
  if (!clean) return targetCase === 'gent' ? 'питомца' : targetCase === 'datv' ? 'питомцу' : targetCase === 'ablt' ? 'питомцем' : 'питомец';
  const known = irregularPetNames[clean]?.[targetCase];
  if (known) return known;
  if (targetCase === 'nomn') return clean;
  if (/а$/i.test(clean)) return clean.replace(/а$/i, targetCase === 'gent' ? 'ы' : targetCase === 'datv' ? 'е' : 'ой');
  if (/я$/i.test(clean)) return clean.replace(/я$/i, targetCase === 'gent' ? 'и' : targetCase === 'datv' ? 'е' : 'ей');
  if (targetCase === 'gent') return `${clean}а`;
  if (targetCase === 'datv') return `${clean}у`;
  return `${clean}ом`;
}

export function formatTodayTitle(petName: string) {
  return petName.trim() ? `Сегодня с ${inflectPetName(petName, 'ablt')}` : 'Сегодня с питомцем';
}

export function formatCount(count: number, forms: [string, string, string]) {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ${forms[0]}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${forms[1]}`;
  return `${count} ${forms[2]}`;
}

export function formatReadinessLabel(level: ReadinessLevel) {
  const labels: Record<ReadinessLevel, string> = {
    ready: 'всё готово',
    partial: 'частично готово',
    blocked: 'нужны данные',
    demo: 'пример',
  };
  return labels[level];
}

export function formatReminderGroupLine(group: string, dueAt: string) {
  const date = new Date(dueAt).toLocaleDateString('ru-RU');
  const groupText: Record<string, string> = {
    просрочено: 'просрочено',
    сегодня: 'сегодня',
    скоро: 'скоро',
  };
  return `${groupText[group] ?? 'в плане'} · ${date}`;
}

const wishlistCategoryLabels: Record<string, string> = {
  food: 'корм',
  treats: 'лакомства',
  toy: 'игрушка',
  gear: 'амуниция',
  health: 'здоровье',
  grooming: 'груминг',
  course: 'курс',
  service: 'сервис',
  other: 'другое',
};

const priorityLabels: Record<string, string> = {
  high: 'важно',
  medium: 'обычный приоритет',
  low: 'можно позже',
};

export function formatWishlistMeta(category: string, priority?: string, reason?: string) {
  return [wishlistCategoryLabels[category] ?? 'вещь', priority ? priorityLabels[priority] ?? 'обычный приоритет' : null, reason || null].filter(Boolean).join(' · ');
}

const zoneTypeLabels: Record<string, string> = {
  home_area: 'домашний район',
  walk_route: 'маршрут',
  safe_place: 'спокойное место',
  risk_zone: 'зона риска',
  clinic: 'ветклиника',
  shop: 'зоомагазин',
  grooming: 'груминг',
};

export function formatZoneMeta(zone: { type: string; radius_meters?: number; radiusMeters?: number; approximate_lat?: number | string | null; approximate_lng?: number | string | null; note?: string }) {
  const radius = zone.radius_meters || zone.radiusMeters || 500;
  const point = zone.approximate_lat && zone.approximate_lng ? 'примерная точка выбрана' : 'без точки';
  return [zoneTypeLabels[zone.type] ?? 'место', `радиус около ${radius} м`, point, zone.note || null].filter(Boolean).join(' · ');
}
