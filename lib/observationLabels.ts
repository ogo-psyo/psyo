const primaryLabels: Record<string,string> = {
  sleep:'Сон',weight:'Вес',activity:'Активность',fear_trigger:'Что испугало',
  dog_reaction:'Реакция на собак',people_reaction:'Реакция на людей',walk:'Прогулка',
  training:'Занятие',medication:'Лекарство',procedure:'Процедура',symptom:'Симптом',behavior_change:'Изменение поведения',
};
export function isPrimaryObservationFact(type?:string):boolean {
  return Boolean(type && !['mood','appetite','stool','energy','note'].includes(type));
}
export function observationTypeLabel(type?:string):string {return primaryLabels[type??'']??'Наблюдение';}
