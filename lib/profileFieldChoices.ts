/** Display labels only: existing persisted values and APIs remain unchanged. */
export function sexLabel(value: string) {
  return ({ 'кобель': 'Мальчик', male: 'Мальчик', 'сука': 'Девочка', female: 'Девочка', 'не указано': 'Не указывать' } as Record<string, string>)[value] || value;
}

export const ageGroupChoices = [
  { value: 'щенок', label: 'Щенок' },
  { value: 'юниор', label: 'Подросток' },
  { value: 'взрослый', label: 'Взрослая собака' },
  { value: 'зрелый', label: 'Зрелая собака' },
  { value: 'сеньор', label: 'Пожилая собака' },
];

export function ageGroup(value: string) {
  const normalized = value.trim().toLocaleLowerCase('ru');
  return ageGroupChoices.find(item => item.value === normalized || item.label.toLocaleLowerCase('ru') === normalized)?.value;
}
