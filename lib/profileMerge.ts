import type { DogProfile } from './data';
export const profileFieldLabels = {
  dogName: 'Имя', breedId: 'Порода', breedGroupId: 'Группа породы', breedCustom: 'Описание породы',
  sex: 'Пол', lifeStage: 'Возраст', weight: 'Вес', microchip: 'Чип', vetClinic: 'Клиника',
  diet: 'Питание', allergies: 'Аллергии', medication: 'Лекарства', healthNotes: 'Особенности здоровья',
  vaccineStatus: 'Прививки', parasiteStatus: 'Обработка от паразитов', socialMode: 'Знакомства',
  temperament: 'Темперамент', energyLevel: 'Энергия', playStyle: 'Игры', trainability: 'Обучение',
  childFriendly: 'Отношение к детям', dogFriendly: 'Отношение к собакам', catFriendly: 'Отношение к кошкам',
  triggers: 'Что беспокоит', aloneTime: 'Одиночество', avatarImageUrl: 'Изображение', photoUrls: 'Фотографии',
} satisfies Partial<Record<keyof DogProfile, string>>;
export type ProfileMergeField = keyof typeof profileFieldLabels;
export type ProfileMerge = { merged: DogProfile; local: DogProfile; remote: DogProfile; conflicts: ProfileMergeField[] };
export function mergeProfileDraft(base: Partial<DogProfile> | undefined, local: DogProfile, remote: DogProfile): ProfileMerge {
  const merged = { ...local, profileVersion: remote.profileVersion };
  const conflicts: ProfileMergeField[] = [];
  const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  for (const key of Object.keys(profileFieldLabels) as ProfileMergeField[]) {
    if (equal(local[key], remote[key])) continue;
    if (base && equal(local[key], base[key])) Object.assign(merged, { [key]: remote[key] });
    else if (!base || !equal(remote[key], base[key])) conflicts.push(key);
  }
  return { merged, conflicts, local, remote };
}
