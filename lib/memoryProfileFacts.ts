import type { DogProfile } from './data';
import { buildAssistantProfileFacts } from './assistantProfileFacts';
import { sexLabel } from './profileFieldChoices';

/** Display only profile fields included in the assistant's actual projection. */
export function memoryProfileFacts(profile: DogProfile) {
  const facts = buildAssistantProfileFacts({
    pet: { name: profile.dogName, breed_id: profile.breedId, breed_group_id: profile.breedGroupId, custom_breed: profile.breedCustom, sex: profile.sex, life_stage: profile.lifeStage || profile.age, weight_kg: parseFloat(profile.weight) || undefined },
    passport: { diet: profile.diet, allergies: profile.allergies, medication: profile.medication, health_notes: profile.healthNotes, vaccine_status: profile.vaccineStatus, parasite_status: profile.parasiteStatus },
    social: { temperament: profile.temperament, energy_level: profile.energyLevel, play_style: profile.playStyle, trainability: profile.trainability, social_mode: profile.socialMode, child_friendly: profile.childFriendly, dog_friendly: profile.dogFriendly, cat_friendly: profile.catFriendly, triggers: profile.triggers?.split(',').map(value => value.trim()).filter(Boolean), alone_time_note: profile.aloneTime },
  });
  const labels: Record<string,string> = { 'возрастная группа': 'Возраст', 'рацион': 'Питание', 'лекарства владельца': 'Лекарства', 'заметки о здоровье': 'Здоровье', 'триггеры': 'Что беспокоит', 'одиночество': 'Как остаётся один' };
  return facts.flatMap(fact => {
    const colon = fact.indexOf(':');
    const key = fact.slice(0,colon), value = fact.slice(colon+1).trim();
    if (!value || /^(не указано|не указан|не указана|не указывать|unknown)$/iu.test(value)) return [];
    return [{ label: labels[key] || key.charAt(0).toUpperCase()+key.slice(1), value: key === 'пол' ? sexLabel(value) : value }];
  });
}
