'use client';

import { energyOptions, friendlinessOptions, neuteredOptions, parasiteOptions, playStyleOptions, sexOptions, sizeOptions, coatOptions, socialOptions, temperamentOptions, trainabilityOptions, vaccineOptions, type DogProfile } from '@/lib/data';

type Field = { key: keyof DogProfile; label: string; options?: string[]; multiline?: boolean };
const groups: Array<{ title: string; fields: Field[] }> = [
  { title: 'Паспорт и внешность', fields: [
    {key:'sex',label:'Пол',options:sexOptions}, {key:'neutered',label:'Стерилизация',options:neuteredOptions}, {key:'weight',label:'Вес'}, {key:'size',label:'Размер',options:sizeOptions}, {key:'coatType',label:'Шерсть',options:coatOptions}, {key:'colorMarks',label:'Окрас и особые приметы'}, {key:'microchip',label:'Номер чипа'},
  ]},
  { title: 'Характер и общение', fields: [
    {key:'temperament',label:'Темперамент',options:temperamentOptions}, {key:'energyLevel',label:'Энергия',options:energyOptions}, {key:'trainability',label:'Обучаемость',options:trainabilityOptions}, {key:'playStyle',label:'Любимые игры',options:playStyleOptions}, {key:'aloneTime',label:'Как остаётся один',multiline:true}, {key:'socialMode',label:'Как начинать знакомство',options:socialOptions}, {key:'childFriendly',label:'С детьми',options:friendlinessOptions}, {key:'dogFriendly',label:'С собаками',options:friendlinessOptions}, {key:'catFriendly',label:'С кошками',options:friendlinessOptions}, {key:'triggers',label:'Что вызывает тревогу',multiline:true},
  ]},
  { title: 'Здоровье и уход', fields: [
    {key:'healthNotes',label:'Важное о здоровье',multiline:true}, {key:'allergies',label:'Аллергии'}, {key:'medication',label:'Лекарства'}, {key:'diet',label:'Питание'}, {key:'vetClinic',label:'Клиника'}, {key:'vaccineStatus',label:'Вакцинация',options:vaccineOptions}, {key:'parasiteStatus',label:'Обработка от паразитов',options:parasiteOptions}, {key:'nextCareDate',label:'Следующий уход'},
  ]},
  { title: 'О собаке', fields: [{key:'neighborhood',label:'Район'}, {key:'bio',label:'Описание',multiline:true}] },
];
export function ExactProfileFields({ draft, onChange }: { draft: DogProfile; onChange: (patch: Partial<DogProfile>) => void }) {
  return <>{groups.map(group => <details key={group.title}><summary>{group.title}</summary>{group.fields.map(({key,label,options,multiline}) => {
    const id=`exact-profile-${key}`,value=String(draft[key] ?? '');
    return <div className="field" key={key}><label htmlFor={id}>{label}</label>{options ? <select id={id} value={value} onChange={event=>onChange({[key]:event.target.value})}>
      <option value="">Не указано</option>{value && !options.includes(value) && <option value={value}>{value}</option>}{options.filter(option => option.toLocaleLowerCase('ru') !== 'не указано').map(option=><option key={option} value={option}>{option}</option>)}
    </select> : multiline ? <textarea id={id} value={value} maxLength={800} onChange={event=>onChange({[key]:event.target.value})}/> : <input id={id} value={value} required={key==='dogName'} maxLength={key==='dogName'?80:180} onChange={event=>onChange({[key]:event.target.value})}/>}</div>;
  })}</details>)}</>;
}
