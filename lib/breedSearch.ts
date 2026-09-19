import source from './breed-directory.json';
import { breedCatalog, type BreedCatalogItem, type DogProfile } from './data';

export function normalizeBreed(value: string) {
  return value.toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
type Entry = { title: string; aliases: string[]; legacy?: BreedCatalogItem };
const familiar: Record<string, string[]> = {
  'Немецкая овчарка': ['немец'], 'Йоркширский терьер': ['йорк', 'yorkie'],
  'Померанский шпиц': ['померанец', 'пом'], 'Джек рассел терьер': ['джек рассел', 'джек расселл'],
  'Ксолоитцкуинтли': ['ксоло', 'xolo', 'xoloitzcuintli', 'мексиканская голая'],
  'Белая швейцарская овчарка': ['бшо'], 'Староанглийская овчарка': ['бобтейл'],
  'Среднеазиатская овчарка': ['алабай'], 'Американский стаффордширский терьер': ['амстафф'],
  'Шотландский терьер': ['скотч терьер'], 'Малая итальянская борзая': ['левретка'],
};

// A name directory, not a new domain enum. Keep existing breed IDs/care profiles.
const entries: Entry[] = source.map(item => ({ ...item, aliases: [...item.aliases, ...(familiar[item.title] || [])] }));
const canonical: Record<string, string> = {
  'chinese-crested': 'Китайская хохлатая собака', papillon: 'Континентальный той спаниель папийон',
  pomeranian: 'Немецкий шпиц той (померанский)', labrador: 'Лабрадор ретривер',
  'cane-corso': 'Итальянский кане корсо', boxer: 'Немецкий боксер', jack: 'Джек рассел терьер',
  'italian-greyhound': 'Малая итальянская борзая', shiba: 'Сиба', husky: 'Сибирский хаски',
};
for (const legacy of breedCatalog.filter(item => !['mixed', 'unknown', 'custom'].includes(item.id))) {
  const name = normalizeBreed(canonical[legacy.id] || legacy.title.split('/')[0]);
  const match = entries.find(item => normalizeBreed(item.title) === name);
  if (match) { match.legacy = legacy; match.aliases.push(legacy.title, legacy.id, ...(legacy.aliases || []), ...(familiar[legacy.title] || [])); }
  else entries.push({ title: legacy.title, aliases: [legacy.id, ...(legacy.aliases || []), ...(familiar[legacy.title] || [])], legacy });
}
entries.unshift({ title: 'Метис', aliases: ['дворняжка', 'смешанная порода', 'mixed breed'], legacy: breedCatalog.find(item => item.id === 'mixed') },
  { title: 'Порода неизвестна', aliases: ['не знаю', 'unknown'], legacy: breedCatalog.find(item => item.id === 'unknown') });
export const breedDirectory = entries;
const indexed = entries.map(item => ({ item, title: normalizeBreed(item.title), terms: [item.title, ...item.aliases].map(normalizeBreed) }));

export function searchBreeds(query: string, limit = 8) {
  const q = normalizeBreed(query);
  if (!q) return [];
  const tokens = q.split(' ');
  return indexed.filter(row => row.terms.some(term => tokens.every(token => term.includes(token))))
    .map(row => ({ ...row, rank: row.title === q ? 0 : row.terms.includes(q) ? 1 : row.title.startsWith(q) ? 2 : 3 }))
    .sort((a, b) => a.rank - b.rank || a.item.title.localeCompare(b.item.title, 'ru'))
    .slice(0, limit).map(row => row.item);
}

export function breedProfilePatch(value: string): Pick<DogProfile, 'breedId' | 'breedGroupId' | 'breedCustom'> {
  const legacy = entries.find(item => normalizeBreed(item.title) === normalizeBreed(value))?.legacy
    || breedCatalog.find(item => normalizeBreed(item.title) === normalizeBreed(value));
  if (legacy) return { breedId: legacy.id, breedGroupId: legacy.groupId, breedCustom: legacy.id === 'mixed' ? 'Метис' : '' };
  return { breedId: value.trim() ? 'custom' : 'mixed', breedGroupId: 'mixed', breedCustom: value };
}

export function breedInputValue(profile: Pick<DogProfile, 'breedId' | 'breedCustom'>) {
  if (profile.breedId === 'custom' || profile.breedId === 'mixed') return profile.breedCustom;
  return entries.find(item => item.legacy?.id === profile.breedId)?.title || '';
}
