import { breedCatalog, breedGroups } from '@/lib/data';

type RawAssistantContext = {
  pet?: Record<string, unknown> | null;
  passport?: Record<string, unknown> | null;
  social?: Record<string, unknown> | null;
};

const profileValueLabels: Record<string, string> = {
  unknown: 'не указано',
  actual: 'актуально',
  adult: 'взрослая',
  puppy: 'щенок',
  senior: 'пожилая',
  medium: 'средняя',
  high: 'высокая',
  low: 'низкая',
  ask_first: 'сначала спросить',
  ok: 'можно знакомиться',
  calm_dogs_only: 'только со спокойными собаками',
  do_not_approach: 'лучше не подходить',
  known_only: 'только свои',
  up_to_date: 'актуально',
  due_soon: 'скоро проверить',
  needs_reminder: 'нужно напоминание',
  overdue: 'просрочено',
  yes: 'да',
  careful: 'осторожно',
  no: 'нет',
};

function text(value: unknown, maxLength = 300) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
  return normalized ? normalized.slice(0, maxLength) : null;
}

function list(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item, 100)).filter((item): item is string => Boolean(item)).slice(0, 8);
}

export function humanAssistantProfileValue(value: unknown) {
  const normalized = text(value);
  if (!normalized) return null;
  return profileValueLabels[normalized] ?? normalized.replaceAll('_', ' ');
}

function breedLabel(pet: Record<string, unknown>) {
  const breedId = text(pet.breed_id);
  const customBreed = text(pet.custom_breed);
  if (breedId === 'custom' && customBreed) return customBreed;
  if (!breedId || breedId === 'mixed' || breedId === 'unknown') return null;
  return breedCatalog.find((breed) => breed.id === breedId)?.title ?? customBreed;
}

function breedGroupLabel(pet: Record<string, unknown>) {
  const groupId = text(pet.breed_group_id);
  if (!groupId || groupId === 'mixed') return null;
  return breedGroups.find((group) => group.id === groupId)?.title ?? null;
}

function add(facts: string[], label: string, value: unknown) {
  const normalized = humanAssistantProfileValue(value);
  if (normalized) facts.push(`${label}: ${normalized}`);
}

/**
 * Produces the only profile projection allowed into the assistant prompt.
 * Identifiers, contacts, microchip data, photos and raw database rows stay out.
 */
export function buildAssistantProfileFacts(context: RawAssistantContext) {
  const pet = context.pet ?? {};
  const passport = context.passport ?? {};
  const social = context.social ?? {};
  const facts: string[] = [];

  add(facts, 'имя', pet.name);
  add(facts, 'порода', breedLabel(pet));
  add(facts, 'группа породы', breedGroupLabel(pet));
  add(facts, 'пол', pet.sex);
  add(facts, 'возрастная группа', pet.life_stage);
  if (Number(pet.weight_kg) > 0) facts.push(`вес: ${Number(pet.weight_kg)} кг`);

  add(facts, 'рацион', passport.diet);
  add(facts, 'аллергии', passport.allergies);
  add(facts, 'лекарства владельца', passport.medication);
  add(facts, 'заметки о здоровье', passport.health_notes);
  add(facts, 'вакцинация', passport.vaccine_status);
  add(facts, 'обработка от паразитов', passport.parasite_status);

  add(facts, 'темперамент', social.temperament);
  add(facts, 'энергия', social.energy_level);
  add(facts, 'стиль игры', social.play_style);
  add(facts, 'обучаемость', social.trainability);
  add(facts, 'знакомства', social.social_mode);
  add(facts, 'отношение к детям', social.child_friendly);
  add(facts, 'отношение к собакам', social.dog_friendly);
  add(facts, 'отношение к кошкам', social.cat_friendly);
  const triggers = list(social.triggers);
  if (triggers.length) facts.push(`триггеры: ${triggers.join(', ')}`);
  add(facts, 'одиночество', social.alone_time_note);

  return facts;
}
