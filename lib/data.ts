export type AvatarStyleId = 'city' | 'neon' | 'winter' | 'space' | 'sticker';
export type BreedGroupId = 'toy' | 'companion' | 'sporting' | 'working' | 'herding' | 'terrier' | 'hound' | 'primitive' | 'mixed';
export type BreedId =
  | 'corgi' | 'samoyed' | 'jack' | 'poodle' | 'shiba' | 'dachshund' | 'labrador' | 'golden' | 'beagle' | 'border-collie'
  | 'german-shepherd' | 'french-bulldog' | 'yorkshire-terrier' | 'chihuahua' | 'husky' | 'spaniel' | 'pomeranian' | 'pug'
  | 'rottweiler' | 'doberman' | 'schnauzer' | 'akita' | 'cane-corso' | 'maltese' | 'bichon' | 'basenji' | 'greyhound'
  | 'xoloitzcuintli' | 'chinese-crested' | 'boxer' | 'dalmatian' | 'great-dane' | 'bernese' | 'australian-shepherd'
  | 'collie' | 'papillon' | 'italian-greyhound' | 'whippet' | 'weimaraner' | 'vizsla' | 'shih-tzu' | 'cavalier'
  | 'bull-terrier' | 'staffordshire-bull-terrier' | 'american-akita' | 'alaskan-malamute' | 'rhodesian-ridgeback'
  | 'mixed' | 'unknown' | 'custom';

export type BreedCareProfile = {
  origin: string;
  sizeRange: string;
  coat: string;
  temperament: string;
  activity: string;
  grooming: string;
  healthWatch: string;
  ownerNotes: string;
  avatarHints: string;
};

export type BreedCatalogItem = {
  id: BreedId;
  groupId: BreedGroupId;
  title: string;
  aliases?: string[];
  emoji: string;
  body: string;
  fur: string;
  vibe: string;
  care?: BreedCareProfile;
};

const defaultCare = (overrides: Partial<BreedCareProfile>): BreedCareProfile => ({
  origin: 'уточнить по владельцу/документам',
  sizeRange: 'зависит от линии и конкретной собаки',
  coat: 'уточняется по фото и заметкам владельца',
  temperament: 'индивидуальный характер важнее стереотипа породы',
  activity: 'умеренная ежедневная нагрузка + отдых',
  grooming: 'регулярный осмотр кожи, шерсти, когтей и ушей',
  healthWatch: 'без диагнозов: любые симптомы и красные флаги — к ветеринару',
  ownerNotes: 'заполнить возраст, вес, шерсть, триггеры и здоровье',
  avatarHints: 'use uploaded photo as primary identity reference',
  ...overrides,
});

export type UploadedPhoto = {
  id: string;
  name: string;
  dataUrl: string;
};

export type DogHabit = {
  id: string;
  title: string;
  value: string;
};

export type DogProfile = {
  backendPetId?: string;
  avatarImageUrl: string;
  avatarSource: 'none' | 'uploaded' | 'generated' | 'demo';
  dogName: string;
  breedId: BreedId;
  breedGroupId: BreedGroupId;
  breedCustom: string;
  breedHint: string;
  neighborhood: string;
  bio: string;
  age: string;
  lifeStage: string;
  sex: string;
  neutered: string;
  weight: string;
  size: string;
  coatType: string;
  colorMarks: string;
  microchip: string;
  temperament: string;
  energyLevel: string;
  trainability: string;
  playStyle: string;
  socialMode: string;
  childFriendly: string;
  dogFriendly: string;
  catFriendly: string;
  aloneTime: string;
  triggers: string;
  healthNotes: string;
  allergies: string;
  diet: string;
  vetClinic: string;
  vaccineStatus: string;
  parasiteStatus: string;
  medication: string;
  nextCareDate: string;
  habits: DogHabit[];
  photos: UploadedPhoto[];
  selectedStyle: AvatarStyleId;
  avatarPrompt: string;
  isPublic: boolean;
  isOnMap: boolean;
  createdAt?: string;
};

export const storageKey = 'pso.product.profile.v5';
export const maxPhotos = 5;

export const defaultHabits: DogHabit[] = [
  { id: 'walk', title: 'Прогулки', value: 'утро и вечер, любит тихие дворы' },
  { id: 'food', title: 'Еда', value: 'ест нормально, лакомства — за команды' },
  { id: 'triggers', title: 'Триггеры', value: 'не любит самокаты и громкие пакеты' },
];

export const defaultProfile: DogProfile = {
  avatarImageUrl: '',
  avatarSource: 'none',
  dogName: '',
  breedId: 'mixed',
  breedGroupId: 'mixed',
  breedCustom: '',
  breedHint: '',
  neighborhood: '',
  bio: '',
  age: '',
  lifeStage: '',
  sex: '',
  neutered: '',
  weight: '',
  size: '',
  coatType: '',
  colorMarks: '',
  microchip: '',
  temperament: '',
  energyLevel: '',
  trainability: '',
  playStyle: '',
  socialMode: '',
  childFriendly: '',
  dogFriendly: '',
  catFriendly: '',
  aloneTime: '',
  triggers: '',
  healthNotes: '',
  allergies: '',
  diet: '',
  vetClinic: '',
  vaccineStatus: '',
  parasiteStatus: '',
  medication: '',
  nextCareDate: '',
  habits: defaultHabits,
  photos: [],
  selectedStyle: 'city',
  avatarPrompt: '',
  isPublic: false,
  isOnMap: false,
};

export const breedGroups = [
  { id: 'mixed', title: 'Метис / не знаю', caption: 'лучше фото + заметки, чем гадание по породе' },
  { id: 'toy', title: 'Мини / той', caption: 'маленькие компаньоны, часто важны хрупкость и тревожность' },
  { id: 'companion', title: 'Компаньоны', caption: 'ориентированы на быт, семью и контакт с человеком' },
  { id: 'sporting', title: 'Охотничьи / спортивные', caption: 'движение, нюх, апорт, вода, высокая активность' },
  { id: 'working', title: 'Рабочие / охранные', caption: 'сила, задача, контроль, потребность в нагрузке' },
  { id: 'herding', title: 'Пастушьи', caption: 'умные, быстрые, любят управлять движением' },
  { id: 'terrier', title: 'Терьеры', caption: 'драйв, добыча, самостоятельность, азарт' },
  { id: 'hound', title: 'Гончие / борзые', caption: 'нюх или зрение, преследование, автономность' },
  { id: 'primitive', title: 'Шпицы / примитивные', caption: 'самостоятельность, чистоплотность, сильный характер' },
] as const;

export const breedCatalog: BreedCatalogItem[] = [
  { id: 'mixed', groupId: 'mixed', title: 'Метис / не знаю', emoji: '✨', body: 'уникальный смешанный силуэт по фото', fur: 'coat inferred from references', vibe: 'one-of-one dog', care: defaultCare({ ownerNotes: 'фото и заметки владельца важнее угадывания породы', avatarHints: 'mixed breed, keep unique silhouette from photo' }) },
  { id: 'unknown', groupId: 'mixed', title: 'Порода неизвестна', emoji: '🔎', body: 'анатомия определяется по фото и заметкам владельца', fur: 'coat inferred from references', vibe: 'mystery companion', care: defaultCare({ ownerNotes: 'сначала собрать факты: размер, шерсть, возраст, поведение', avatarHints: 'unknown breed, infer from photo, avoid generic corgi/spitz' }) },
  { id: 'custom', groupId: 'mixed', title: 'Другая порода', emoji: '✍️', body: 'использовать введённую владельцем породу и фото', fur: 'coat inferred from references', vibe: 'custom breed identity', care: defaultCare({ ownerNotes: 'ввести название породы/типа в заметку породы', avatarHints: 'custom breed identity, follow owner breed note and photo' }) },
  { id: 'xoloitzcuintli', groupId: 'primitive', title: 'Ксолоитцкуинтли / ксоло', aliases: ['ксоло', 'xolo', 'mexican hairless dog', 'мексиканская голая собака'], emoji: '🗿', body: 'стройный древний примитивный силуэт, длинные ноги, клиновидная морда, большие уши', fur: 'hairless or coated; often dark bare skin with sparse crest/tufts', vibe: 'ancient calm alien prince', care: defaultCare({ origin: 'Мексика, древняя примитивная порода', sizeRange: 'toy / miniature / standard; от маленького до среднего-крупного', coat: 'голая разновидность или короткошёрстная; кожа часто тёмная, чувствительная к солнцу/холоду', temperament: 'спокойный, привязчивый, наблюдательный, может быть осторожным с чужими', activity: 'умеренная нагрузка, прогулки без перегрева/переохлаждения', grooming: 'уход за кожей, защита от солнца и холода, мягкое мытьё без пересушивания', healthWatch: 'кожа, зубы/прикус у голых линий, перегрев/переохлаждение; схему ухода уточнять у ветеринара', ownerNotes: 'важно указать: голый или coated, размер, цвет кожи, есть ли хохолок/пятна', avatarHints: 'xoloitzcuintli mexican hairless dog, mostly hairless dark skin, sparse white crest on head, large ears, long elegant legs, not corgi, not fluffy' }) },
  { id: 'chinese-crested', groupId: 'toy', title: 'Китайская хохлатая', aliases: ['китайская хохлатая', 'chinese crested', 'хохлатая'], emoji: '🪶', body: 'маленький изящный корпус, длинные тонкие лапы, выразительная морда', fur: 'hairless body with crest/socks/tail plume or powderpuff coat', vibe: 'delicate punk elf', care: defaultCare({ origin: 'компаньонская декоративная порода', sizeRange: 'маленькая', coat: 'голая разновидность с хохолком/носочками/плюмажем или пуховая powderpuff', temperament: 'контактная, чувствительная, часто очень ориентирована на человека', activity: 'умеренная, короткие регулярные прогулки и игры', grooming: 'кожа/шерсть требуют регулярного ухода; защита от холода и солнца', healthWatch: 'кожа, зубы, колени/суставы у мелких собак; при симптомах — ветеринар', ownerNotes: 'по фото важно отмечать хохолок, голую кожу, пятна и размер', avatarHints: 'chinese crested dog, hairless body, white head crest, fluffy socks and tail plume, slender toy dog, not corgi, not fluffy spitz' }) },
  { id: 'chihuahua', groupId: 'toy', title: 'Чихуахуа', emoji: '🌶️', body: 'очень маленький корпус, выразительные глаза, крупные уши', fur: 'short or long coat', vibe: 'tiny bold monarch' },
  { id: 'papillon', groupId: 'toy', title: 'Папийон', aliases: ['papillon', 'континентальный той-спаниель'], emoji: '🦋', body: 'маленький лёгкий корпус, большие уши-бабочки, тонкая морда', fur: 'шелковистая шерсть с очёсами на ушах и хвосте', vibe: 'smart tiny butterfly', care: defaultCare({ origin: 'европейская декоративная порода', sizeRange: 'мини / маленькая', coat: 'шелковистая, с очёсами, без тяжёлого подшёрстка', temperament: 'живой, умный, контактный, часто спортивнее чем выглядит', activity: 'короткие прогулки + игры/обучение', grooming: 'расчёсывание очёсов, уши, зубы и когти', avatarHints: 'papillon dog, tiny elegant body, huge butterfly ears with long fringes, silky coat, bright alert face' }) },
  { id: 'pomeranian', groupId: 'toy', title: 'Померанский шпиц', emoji: '🧡', body: 'миниатюрный пушистый силуэт, лисья мордочка', fur: 'dense fluffy double coat', vibe: 'pocket cloud boss' },
  { id: 'yorkshire-terrier', groupId: 'toy', title: 'Йоркширский терьер', emoji: '🎀', body: 'маленький компактный корпус, тонкая морда', fur: 'silky long coat', vibe: 'tiny terrier star' },
  { id: 'maltese', groupId: 'toy', title: 'Мальтезе', emoji: '🤍', body: 'маленький элегантный корпус, мягкое выражение', fur: 'long white silky coat', vibe: 'soft salon companion' },
  { id: 'poodle', groupId: 'companion', title: 'Пудель', emoji: '🎀', body: 'элегантный силуэт, кудрявая шерсть, длинные лапы', fur: 'curly sculpted coat', vibe: 'smart stylish companion' },
  { id: 'french-bulldog', groupId: 'companion', title: 'Французский бульдог', emoji: '🥐', body: 'компактный мускулистый корпус, плоская морда, большие уши', fur: 'short smooth coat', vibe: 'city couch comedian' },
  { id: 'pug', groupId: 'companion', title: 'Мопс', emoji: '🥯', body: 'компактный круглый корпус, плоская морда, хвост кольцом', fur: 'short smooth coat', vibe: 'small dramatic roommate' },
  { id: 'shih-tzu', groupId: 'companion', title: 'Ши-тцу', aliases: ['ши тцу', 'shih tzu'], emoji: '🪷', body: 'маленький крепкий корпус, короткая морда, высоко несущийся хвост', fur: 'длинная густая шерсть или pet-cut', vibe: 'little palace companion', care: defaultCare({ origin: 'компаньонская порода', sizeRange: 'маленькая', coat: 'длинная шерсть требует ухода; часто стригут в pet-cut', temperament: 'ласковый, упрямо-самостоятельный, домашний компаньон', activity: 'умеренная, без перегрева', grooming: 'регулярный груминг, глаза, морда, уши, зубы', healthWatch: 'жара/дыхание у короткомордых, глаза, кожа; при симптомах — ветеринар', avatarHints: 'shih tzu, small sturdy companion dog, short muzzle, flowing coat or puppy cut, round expressive face' }) },
  { id: 'cavalier', groupId: 'companion', title: 'Кавалер кинг чарльз спаниель', aliases: ['кавалер', 'cavalier king charles spaniel'], emoji: '👑', body: 'маленький гармоничный корпус, мягкая морда, длинные уши', fur: 'шелковистая шерсть с очёсами', vibe: 'gentle royal friend', care: defaultCare({ origin: 'компаньонская порода', sizeRange: 'маленькая', coat: 'шелковистая средне-длинная шерсть', temperament: 'мягкий, контактный, дружелюбный', activity: 'умеренная прогулка + контакт с человеком', grooming: 'уши, очёсы, зубы, контроль веса', healthWatch: 'сердце, уши, глаза; плановые осмотры особенно важны', avatarHints: 'cavalier king charles spaniel, small gentle dog, long silky ears, soft round eyes, feathered coat' }) },
  { id: 'bichon', groupId: 'companion', title: 'Бишон фризе', emoji: '☁️', body: 'маленький округлый силуэт, мягкое выражение', fur: 'white curly fluffy coat', vibe: 'walking marshmallow' },
  { id: 'labrador', groupId: 'sporting', title: 'Лабрадор', emoji: '🟡', body: 'крепкий дружелюбный корпус, мягкие уши, широкая морда', fur: 'short yellow/black/chocolate coat', vibe: 'golden-hearted explorer' },
  { id: 'golden', groupId: 'sporting', title: 'Золотистый ретривер', emoji: '🌞', body: 'средне-крупный гармоничный корпус, мягкая морда', fur: 'golden feathered coat', vibe: 'sunny loyal friend' },
  { id: 'spaniel', groupId: 'sporting', title: 'Спаниель', emoji: '🍂', body: 'компактный корпус, длинные уши, мягкий взгляд', fur: 'feathered wavy coat', vibe: 'curious sniffing buddy' },
  { id: 'weimaraner', groupId: 'sporting', title: 'Веймаранер', aliases: ['weimaraner', 'вейм'], emoji: '🌫️', body: 'крупный атлетичный корпус, глубокая грудь, длинная морда', fur: 'короткая гладкая серебристо-серая шерсть', vibe: 'silver shadow athlete', care: defaultCare({ origin: 'охотничья спортивная порода', sizeRange: 'крупная', coat: 'короткая гладкая серая шерсть', temperament: 'энергичный, привязчивый, чувствительный, требует занятий', activity: 'высокая: прогулки, нюх, обучение, контролируемая нагрузка', grooming: 'минимальный груминг, уши, когти, кожа', healthWatch: 'перегрузка, ЖКТ/вздутие у крупных, тревожность; симптомы — к врачу', avatarHints: 'weimaraner dog, athletic tall silver-gray short coat, amber eyes, long elegant muzzle, deep chest' }) },
  { id: 'vizsla', groupId: 'sporting', title: 'Венгерская выжла', aliases: ['выжла', 'vizsla'], emoji: '🧡', body: 'средне-крупный сухой атлетичный корпус, длинные ноги', fur: 'короткая гладкая рыжевато-золотая шерсть', vibe: 'velcro copper athlete', care: defaultCare({ origin: 'легавая спортивная порода', sizeRange: 'средне-крупная', coat: 'короткая гладкая рыжая шерсть', temperament: 'очень контактная, активная, чувствительная', activity: 'высокая: бег, нюх, обучение, работа головой', grooming: 'минимальный груминг, уши, когти, восстановление после нагрузки', avatarHints: 'hungarian vizsla, sleek copper-rust short coat, athletic lean body, long ears, gentle expressive face' }) },
  { id: 'border-collie', groupId: 'herding', title: 'Бордер-колли', emoji: '🧠', body: 'атлетичный средний корпус, внимательный взгляд', fur: 'medium double coat', vibe: 'genius motion manager' },
  { id: 'australian-shepherd', groupId: 'herding', title: 'Австралийская овчарка', aliases: ['аусси', 'aussie', 'australian shepherd'], emoji: '🌈', body: 'средний атлетичный корпус, выразительный взгляд, часто мерль', fur: 'средняя двойная шерсть, возможны merle/tri окрасы', vibe: 'colorful motion genius', care: defaultCare({ origin: 'пастушья рабочая порода', sizeRange: 'средняя', coat: 'двойная средняя шерсть, нужны расчёсывания', temperament: 'умная, активная, чувствительная к хаосу', activity: 'высокая умственная и физическая нагрузка', grooming: 'расчёсывание, линька, лапы, уши', healthWatch: 'перевозбуждение, глаза/слух у merle-линий; обследования у специалиста', avatarHints: 'australian shepherd, medium athletic herding dog, merle or tri-color coat, expressive eyes, fluffy tail/ruff' }) },
  { id: 'collie', groupId: 'herding', title: 'Колли', aliases: ['rough collie', 'smooth collie'], emoji: '🌾', body: 'элегантный средне-крупный корпус, длинная клиновидная морда', fur: 'длинная богатая или гладкая шерсть', vibe: 'gentle intelligent shepherd', care: defaultCare({ origin: 'пастушья порода', sizeRange: 'средне-крупная', coat: 'rough или smooth; длинная требует расчёсывания', temperament: 'мягкая, умная, ориентированная на семью', activity: 'умеренно-высокая, любит задачи и рутину', grooming: 'шерсть/подшёрсток, уши, лапы', avatarHints: 'collie dog, elegant long wedge-shaped muzzle, graceful herding body, sable/white or tricolor coat, gentle face' }) },
  { id: 'corgi', groupId: 'herding', title: 'Корги', emoji: '🦊', body: 'низкий длинный корпус, короткие лапы, большие стоячие уши', fur: 'red/white dense coat', vibe: 'cheeky city fox' },
  { id: 'german-shepherd', groupId: 'herding', title: 'Немецкая овчарка', emoji: '🛡️', body: 'крупный атлетичный корпус, стоячие уши, длинная морда', fur: 'dense double coat', vibe: 'focused guardian' },
  { id: 'rottweiler', groupId: 'working', title: 'Ротвейлер', emoji: '🖤', body: 'мощный компактный корпус, широкая голова', fur: 'short black coat with tan marks', vibe: 'calm powerful guardian' },
  { id: 'doberman', groupId: 'working', title: 'Доберман', emoji: '⚔️', body: 'стройный мускулистый корпус, длинные линии', fur: 'short glossy coat', vibe: 'sleek sentinel' },
  { id: 'cane-corso', groupId: 'working', title: 'Кане-корсо', emoji: '🪨', body: 'крупный мощный корпус, массивная голова', fur: 'short dense coat', vibe: 'ancient stone guardian' },
  { id: 'boxer', groupId: 'working', title: 'Боксёр', aliases: ['boxer'], emoji: '🥊', body: 'средне-крупный мускулистый корпус, квадратная морда', fur: 'короткая гладкая рыжая/тигровая шерсть с белыми отметинами', vibe: 'goofy muscular guardian', care: defaultCare({ origin: 'рабочая/охранная порода-компаньон', sizeRange: 'средне-крупная', coat: 'короткая гладкая шерсть', temperament: 'игривый, контактный, энергичный, эмоциональный', activity: 'умеренно-высокая, без перегрева', grooming: 'минимальный груминг, складки/морда, когти', healthWatch: 'жара/дыхание, сердце, кожа; симптомы — к ветеринару', avatarHints: 'boxer dog, muscular square body, short fawn or brindle coat, white chest, expressive wrinkled muzzle' }) },
  { id: 'great-dane', groupId: 'working', title: 'Немецкий дог', aliases: ['great dane', 'дог'], emoji: '🏛️', body: 'гигантский высокий корпус, длинные ноги, благородная голова', fur: 'короткая гладкая шерсть разных окрасов', vibe: 'gentle giant statue', care: defaultCare({ origin: 'гигантская рабочая порода', sizeRange: 'гигантская', coat: 'короткая гладкая', temperament: 'спокойный, мягкий, но очень крупный', activity: 'умеренная, беречь суставы и восстановление', grooming: 'минимальный груминг, когти, суставы, место для отдыха', healthWatch: 'суставы, сердце, риск вздутия у гигантов; плановый ветконтроль', avatarHints: 'great dane, giant tall elegant dog, long legs, deep chest, noble head, short smooth coat' }) },
  { id: 'bernese', groupId: 'working', title: 'Бернский зенненхунд', aliases: ['берн', 'bernese mountain dog'], emoji: '⛰️', body: 'крупный мощный корпус, мягкая голова, густой хвост', fur: 'длинная трёхцветная шерсть black white rust', vibe: 'gentle mountain bear', care: defaultCare({ origin: 'швейцарская рабочая горная порода', sizeRange: 'крупная', coat: 'густая длинная трёхцветная шерсть', temperament: 'мягкий, семейный, спокойный, сильный', activity: 'умеренная, без перегрева', grooming: 'регулярное расчёсывание, линька, лапы', healthWatch: 'суставы, вес, перегрев у крупных; симптомы — к врачу', avatarHints: 'bernese mountain dog, large fluffy tricolor black white rust coat, gentle face, mountain dog body' }) },
  { id: 'samoyed', groupId: 'working', title: 'Самоед', emoji: '☁️', body: 'пушистый объёмный силуэт, улыбка, хвост кольцом', fur: 'white fluffy double coat', vibe: 'soft cloud, criminal mind' },
  { id: 'jack', groupId: 'terrier', title: 'Джек-рассел', emoji: '⚡', body: 'компактный спортивный корпус, острые глаза, быстрые лапы', fur: 'white coat with tan/black spots', vibe: 'tiny chaos athlete' },
  { id: 'schnauzer', groupId: 'terrier', title: 'Шнауцер', emoji: '🧔', body: 'крепкий квадратный корпус, брови и борода', fur: 'wiry salt-and-pepper coat', vibe: 'serious little inspector' },
  { id: 'bull-terrier', groupId: 'terrier', title: 'Бультерьер', aliases: ['bull terrier'], emoji: '🥚', body: 'мускулистый корпус, яйцевидная голова, маленькие глаза', fur: 'короткая гладкая шерсть', vibe: 'comic gladiator', care: defaultCare({ origin: 'терьерная порода', sizeRange: 'средняя', coat: 'короткая гладкая', temperament: 'энергичный, упрямый, комичный, требует правил', activity: 'умеренно-высокая, игры и обучение без хаоса', grooming: 'минимальный груминг, кожа, когти', healthWatch: 'кожа, слух у белых линий, суставы; симптомы — ветеринар', avatarHints: 'bull terrier, muscular dog, distinctive egg-shaped head, small triangular eyes, short smooth coat' }) },
  { id: 'staffordshire-bull-terrier', groupId: 'terrier', title: 'Стаффордширский бультерьер', aliases: ['стаффи', 'staffy', 'staffordshire bull terrier'], emoji: '💪', body: 'компактный очень мускулистый корпус, широкая улыбка', fur: 'короткая гладкая шерсть разных окрасов', vibe: 'small strong velvet tank', care: defaultCare({ origin: 'терьер-компаньон', sizeRange: 'средняя компактная', coat: 'короткая гладкая', temperament: 'человекоориентированный, энергичный, сильный', activity: 'регулярная нагрузка и самоконтроль', grooming: 'минимальный груминг, кожа, когти', healthWatch: 'кожа/аллергии, суставы, перегрев; при симптомах — ветеринар', avatarHints: 'staffordshire bull terrier, compact muscular dog, broad head, short smooth coat, friendly strong expression' }) },
  { id: 'dachshund', groupId: 'hound', title: 'Такса', emoji: '🌭', body: 'очень длинный корпус, короткие лапы, вытянутая морда', fur: 'smooth, long or wire coat', vibe: 'dramatic tunnel expert' },
  { id: 'beagle', groupId: 'hound', title: 'Бигль', emoji: '👃', body: 'компактный корпус, длинные уши, сильный нос', fur: 'short tricolor coat', vibe: 'sniffing optimist' },
  { id: 'greyhound', groupId: 'hound', title: 'Грейхаунд / борзая', emoji: '🏹', body: 'очень стройный высокий корпус, глубокая грудь', fur: 'short smooth coat', vibe: 'quiet lightning' },
  { id: 'italian-greyhound', groupId: 'hound', title: 'Левретка', aliases: ['итальянская борзая', 'italian greyhound', 'iggy'], emoji: '🫧', body: 'миниатюрная борзая, очень тонкие ноги, глубокая грудь', fur: 'очень короткая гладкая шерсть', vibe: 'fragile tiny lightning', care: defaultCare({ origin: 'декоративная борзая', sizeRange: 'мини / маленькая', coat: 'очень короткая шерсть, мёрзнет', temperament: 'нежная, чувствительная, быстрая, привязчивая', activity: 'короткие активные рывки + тепло и отдых', grooming: 'минимальный груминг, одежда в холод, зубы/когти', healthWatch: 'хрупкость лап, зубы, холод; травмы — срочно к врачу', avatarHints: 'italian greyhound, tiny slender sighthound, very long thin legs, deep chest, delicate narrow face, short coat' }) },
  { id: 'whippet', groupId: 'hound', title: 'Уиппет', aliases: ['whippet'], emoji: '💨', body: 'средняя борзая, глубокая грудь, тонкая талия, длинные ноги', fur: 'короткая гладкая шерсть', vibe: 'sofa rocket', care: defaultCare({ origin: 'борзая', sizeRange: 'средняя', coat: 'короткая гладкая, мёрзнет в холод', temperament: 'дома мягкий, на улице быстрый и азартный', activity: 'спринты/игры в безопасном месте + отдых', grooming: 'минимальный груминг, одежда в холод, когти', healthWatch: 'травмы на рывках, холод, кожа; симптомы — ветеринар', avatarHints: 'whippet, elegant medium sighthound, deep chest, tucked waist, long legs, short smooth coat' }) },
  { id: 'rhodesian-ridgeback', groupId: 'hound', title: 'Родезийский риджбек', aliases: ['риджбек', 'rhodesian ridgeback'], emoji: '🦁', body: 'крупный атлетичный корпус, характерный ridge на спине', fur: 'короткая пшенично-рыжая шерсть', vibe: 'lion-hearted runner', care: defaultCare({ origin: 'африканская гончая/охранная порода', sizeRange: 'крупная', coat: 'короткая гладкая пшеничная шерсть', temperament: 'самостоятельный, сильный, спокойный при правилах', activity: 'регулярная нагрузка, нюх, контроль импульса', grooming: 'минимальный груминг, кожа, когти', healthWatch: 'суставы, кожа, травмы от рывков; симптомы — ветеринар', avatarHints: 'rhodesian ridgeback, large athletic wheaten dog, short coat, distinctive ridge along back, strong elegant body' }) },
  { id: 'shiba', groupId: 'primitive', title: 'Сиба-ину', emoji: '🔥', body: 'компактный лисий силуэт, стоячие уши, хвост кольцом', fur: 'red/cream double coat', vibe: 'independent little legend' },
  { id: 'husky', groupId: 'primitive', title: 'Хаски', emoji: '❄️', body: 'атлетичный северный корпус, стоячие уши, пушистый хвост', fur: 'thick double coat', vibe: 'snowy escape artist' },
  { id: 'akita', groupId: 'primitive', title: 'Акита', emoji: '🏯', body: 'крупный мощный шпицеобразный корпус, хвост кольцом', fur: 'dense double coat', vibe: 'dignified silent guardian' },
  { id: 'american-akita', groupId: 'primitive', title: 'Американская акита', aliases: ['american akita'], emoji: '🗻', body: 'крупный тяжёлый шпицеобразный корпус, широкая голова, хвост кольцом', fur: 'густая двойная шерсть разных окрасов', vibe: 'serious mountain guardian', care: defaultCare({ origin: 'крупная примитивная/охранная порода', sizeRange: 'крупная', coat: 'густая двойная шерсть, выраженная линька', temperament: 'самостоятельная, серьёзная, лояльная, требует правил', activity: 'умеренно-высокая, без хаотичных контактов', grooming: 'расчёсывание подшёрстка, линька, когти', healthWatch: 'суставы, кожа, вес, поведенческие риски; консультации специалистов', avatarHints: 'american akita, large powerful spitz dog, broad bear-like head, curled tail, dense double coat, serious guardian look' }) },
  { id: 'alaskan-malamute', groupId: 'primitive', title: 'Аляскинский маламут', aliases: ['маламут', 'alaskan malamute'], emoji: '🏔️', body: 'крупный северный корпус, мощная грудь, пушистый хвост', fur: 'очень густая двойная северная шерсть', vibe: 'arctic freight engine', care: defaultCare({ origin: 'северная ездовая порода', sizeRange: 'крупная', coat: 'густая двойная шерсть, сильная линька', temperament: 'самостоятельный, дружелюбный, сильный, не всегда послушный', activity: 'высокая выносливость, тяга, холод лучше жары', grooming: 'интенсивное вычёсывание, контроль перегрева', healthWatch: 'жара, суставы, вес; симптомы — ветеринар', avatarHints: 'alaskan malamute, large arctic sled dog, thick grey-white double coat, powerful body, fluffy curled tail' }) },
  { id: 'basenji', groupId: 'primitive', title: 'Басенджи', emoji: '🌀', body: 'стройный компактный корпус, морщинистый лоб, хвост кольцом', fur: 'short fine coat', vibe: 'silent clever cat-dog' },
  { id: 'dalmatian', groupId: 'working', title: 'Далматин', aliases: ['dalmatian'], emoji: '⚪', body: 'средне-крупный атлетичный корпус, длинные линии', fur: 'короткая белая шерсть с чёрными/коричневыми пятнами', vibe: 'spotted endurance clown', care: defaultCare({ origin: 'каретная/рабочая порода', sizeRange: 'средне-крупная', coat: 'короткая пятнистая шерсть', temperament: 'активный, умный, социальный, требует нагрузки', activity: 'высокая выносливость, прогулки и обучение', grooming: 'короткая шерсть, но заметная линька; уши, когти', healthWatch: 'слух, мочевая система/камни у породы; плановый ветконтроль', avatarHints: 'dalmatian dog, athletic white short coat with black spots, elegant long lines, alert friendly face' }) },
] as const;

export const lifeStageOptions = ['щенок', 'юниор', 'взрослый', 'зрелый', 'сеньор'];
export const sexOptions = ['кобель', 'сука', 'не указано'];
export const neuteredOptions = ['да', 'нет', 'не знаю', 'не указано'];
export const sizeOptions = ['мини', 'маленький', 'средний', 'крупный', 'гигантский'];
export const coatOptions = ['гладкая', 'короткая', 'длинная', 'жёсткая', 'кудрявая', 'двойная/пушистая', 'почти без шерсти'];
export const energyOptions = ['диванный', 'спокойный', 'средний', 'активный', 'ракета'];
export const temperamentOptions = ['мягкий', 'уверенный', 'осторожный', 'игривый', 'независимый', 'охранный', 'тревожный'];
export const trainabilityOptions = ['учится легко', 'нужна мотивация', 'упрямится', 'работает за еду', 'работает за игру'];
export const playStyleOptions = ['спокойный контакт', 'догонялки', 'апорт', 'борьба', 'нюховые игры', 'не любит игры'];
export const socialOptions = ['можно знакомиться', 'сначала спросить', 'только спокойные собаки', 'лучше не подходить', 'только свои'];
export const friendlinessOptions = ['да', 'осторожно', 'нет', 'не знаю'];
export const vaccineOptions = ['актуально', 'скоро нужно', 'просрочено', 'не знаю'];
export const parasiteOptions = ['актуально', 'поставить напоминание', 'просрочено', 'не знаю'];

export const avatarStyles = [
  { id: 'city', title: 'City Walk', caption: 'городской исследователь', emoji: '🌆', trait: 'Explorer', scene: 'stylized night city board, glowing crosswalks, premium toy render' },
  { id: 'neon', title: 'Neon Park', caption: 'ночной парк и glow-ошейник', emoji: '💜', trait: 'Glow pup', scene: 'neon dog park, holographic grass, cyan and violet rim light' },
  { id: 'winter', title: 'Winter Coat', caption: 'куртка, снег и тёплый вайб', emoji: '🧥', trait: 'Snow scout', scene: 'winter city walk, soft snow, premium puffer coat, cold blue light' },
  { id: 'space', title: 'Space Dog', caption: 'маленький космонавт района', emoji: '🚀', trait: 'Orbit dog', scene: 'tiny astronaut dog, orbital city map, glossy helmet, cinematic stars' },
  { id: 'sticker', title: 'Sticker Mode', caption: 'карточка для сторис и чатов', emoji: '✨', trait: 'Icon mode', scene: 'bold sticker collectible, clean outline, social sharing card' },
] as const;

export const nearbyDogs = [
  { name: 'Бублик', caption: 'джек-рассел · ищет компанию', emoji: '🐕', distance: '240 м' },
  { name: 'Луна', caption: 'корги · часто гуляет тут', emoji: '🐶', distance: '410 м' },
  { name: 'Арчи', caption: 'пудель · спокойный круг', emoji: '🐩', distance: '680 м' },
];

export const careEvents = [
  { title: 'Вакцинация', caption: 'статус и следующая дата', emoji: '💉' },
  { title: 'Обработка', caption: 'клещи / глисты / напоминания', emoji: '🛡️' },
  { title: 'Ветклиника', caption: 'основная клиника и контакты', emoji: '🏥' },
];

export const anchorCards = [
  { title: 'Паспортичка', caption: 'имя, фото, порода, возраст, вес, микрочип, ветклиника', emoji: '🪪' },
  { title: 'Карта и зоны', caption: 'домашняя зона, безопасные маршруты, собачьи места без точного GPS', emoji: '🗺️' },
  { title: 'Социализация', caption: 'как знакомиться, триггеры, дети/кошки/собаки, совместимость', emoji: '🐕' },
  { title: 'Ассистент', caption: 'воспитание, уход, triage симптомов, подготовка к ситуациям', emoji: '🧠' },
  { title: 'Напоминания', caption: 'прививки, обработки, лекарства, груминг, корм, тренировки', emoji: '⏰' },
  { title: 'Клиники и ветшопы', caption: 'контакты, записи, рекомендации, партнёрские подборки', emoji: '🏥' },
  { title: 'Подборки', caption: 'товары, маршруты, курсы, чек-листы под профиль собаки', emoji: '🛍️' },
  { title: 'Вишлисты', caption: 'что купить собаке, подарки, расходники, wish/share list', emoji: '🎁' },
];

export const assistantScenarios = [
  { title: 'Воспитание', caption: 'пошаговые планы: поводок, подзыв, одиночество, лай, туалет', emoji: '🎓' },
  { title: 'Владение', caption: 'что делать сегодня: прогулка, еда, уход, документы, сезонные риски', emoji: '🏡' },
  { title: 'Здоровье без псевдодиагнозов', caption: 'triage: что проверить, какие красные флаги, когда к врачу', emoji: '🩺' },
  { title: 'Покупки и сервисы', caption: 'подбор корма, амуниции, игрушек, клиник и ветшопов по контексту', emoji: '🧾' },
];

export const productNext = [
  { title: 'Core app shell', caption: 'паспортичка + напоминания + ассистент как домашний экран', emoji: '🏠' },
  { title: 'AI assistant', caption: 'контекстные ответы по профилю собаки с безопасной ветеринарной рамкой', emoji: '🧠' },
  { title: 'Partner layer', caption: 'клиники, ветшопы, подборки и вишлисты без агрессивной рекламы', emoji: '🤝' },
];

export function getBreed(id: BreedId) {
  return breedCatalog.find((breed) => breed.id === id) ?? breedCatalog[0];
}

export function getBreedCare(id: BreedId) {
  const breed = getBreed(id);
  return breed.care ?? defaultCare({
    ownerNotes: `типовой профиль для породы: ${breed.title}; уточнить индивидуальные особенности`,
    avatarHints: `${breed.title}, ${breed.body}, ${breed.fur}, ${breed.vibe}`,
  });
}

export function getBreedGroup(id: BreedGroupId) {
  return breedGroups.find((group) => group.id === id) ?? breedGroups[0];
}

export function getBreedLabel(profile: Pick<DogProfile, 'breedId' | 'breedCustom'>) {
  if (profile.breedId === 'custom' && profile.breedCustom.trim()) return profile.breedCustom.trim();
  return getBreed(profile.breedId).title;
}

export function getAvatarStyle(id: AvatarStyleId) {
  return avatarStyles.find((style) => style.id === id) ?? avatarStyles[0];
}

export function buildAvatarPrompt(profile: DogProfile) {
  const breed = getBreed(profile.breedId);
  const care = getBreedCare(profile.breedId);
  const breedLabel = getBreedLabel(profile);
  const group = getBreedGroup(profile.breedGroupId);
  const style = getAvatarStyle(profile.selectedStyle);
  return [
    `Create a premium 3D stylized dog avatar, not a flat icon.`,
    `Dog name: ${profile.dogName || 'unnamed dog'}.`,
    `Breed reference: ${breedLabel}; breed group: ${group.title}; anatomy: ${breed.body}; fur: ${breed.fur}; vibe: ${breed.vibe}.`,
    `Breed visual guide: ${care.avatarHints}.`,
    `Appearance notes: ${[profile.size, profile.coatType, profile.colorMarks, profile.breedHint].filter(Boolean).join(', ') || 'use uploaded photo references for coat and face details'}.`,
    `Personality: ${profile.temperament || 'friendly'}, energy: ${profile.energyLevel || 'medium'}, play style: ${profile.playStyle || 'urban explorer'}.`,
    `Scene/style: ${style.title}; ${style.scene}.`,
    `Output: collectible 3D toy-quality avatar, expressive face, full body visible, polished materials, soft cinematic lighting, transparent/clean background, suitable for map pin and public dog card.`,
    `Avoid: scary, realistic photo copy, generic emoji, low-detail cartoon, human features, extra dogs, text in image.`,
  ].join(' ');
}
