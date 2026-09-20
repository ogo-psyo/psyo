import { describe, it, expect } from 'vitest';
import { defaultProfile, type DogProfile } from '../../../lib/data';
import { memoryProfileFacts } from '../../../lib/memoryProfileFacts';
function blank(): DogProfile {
  const profile = { ...defaultProfile };
  for (const key of Object.keys(profile) as (keyof DogProfile)[]) {
    const value = profile[key];
    Object.assign(profile, { [key]: typeof value === 'string' ? '' : Array.isArray(value) ? [] : value });
  }
  return profile;
}
describe('memory known-profile projection', () => {
  it('does not invent knowledge from empty fields or unknown enums', () => {
    expect(memoryProfileFacts({...blank(),vaccineStatus:'unknown',sex:'не указано',parasiteStatus:'не указано'})).toEqual([]);
  });
  it('shows actual relevant profile facts, friendly values, not private identifiers', () => {
    const facts=memoryProfileFacts({...blank(),dogName:'Плутон',breedId:'custom',breedCustom:'Ксоло',lifeStage:'7 лет',sex:'кобель',weight:'17',diet:'Сухой корм',allergies:'Курица',dogFriendly:'careful',microchip:'PRIVATE-CHIP',vetClinic:'PRIVATE-ADDRESS',backendPetId:'PRIVATE-ID'});
    const text=JSON.stringify(facts);
    for(const value of ['Плутон','Ксоло','7 лет','Мальчик','17 кг','Сухой корм','Курица','осторожно'])expect(text).toContain(value);
    expect(text).not.toMatch(/PRIVATE-|careful|кобель/);
  });
  it('reflects current values instead of retaining a stale profile summary', () => {
    const p={...blank(),dogName:'Мята',diet:'Корм А'};
    expect(JSON.stringify(memoryProfileFacts(p))).toContain('Корм А');
    expect(JSON.stringify(memoryProfileFacts({...p,diet:'Корм Б'}))).not.toContain('Корм А');
    expect(JSON.stringify(memoryProfileFacts({...p,diet:''}))).not.toContain('Питание');
  });
});
