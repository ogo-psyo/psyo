const socialLabels: Record<string, string> = {
  ok: 'можно знакомиться',
  ask_first: 'сначала спросить',
  calm_dogs_only: 'только спокойные собаки',
  do_not_approach: 'лучше не подходить',
  known_only: 'только свои',
};

export type PublicDogCardFields = {
  name: string;
  breed: string;
  character: string;
  bio: string;
  social: string;
  triggers: string;
  area: string;
  image: string;
};

function text(value: unknown, fallback = '') {
  const clean = typeof value === 'string' ? value.trim() : '';
  return clean ? clean.slice(0, 240) : fallback;
}

export function slugifyPublicDogCard(value: string) {
  const base = value.trim().toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '');
  return base || `dog-${crypto.randomUUID().slice(0, 8)}`;
}

export function safePublicImage(value: unknown) {
  const url = text(value);
  return /^https?:\/\//i.test(url) ? url.slice(0, 1200) : '';
}

export function normalizePublicDogCardFields(input: Record<string, unknown> = {}): PublicDogCardFields {
  const rawSocial = text(input.social, 'ask_first');
  return {
    name: text(input.name, 'Собака'),
    breed: text(input.breed, 'не указано'),
    character: text(input.character, 'спокойный друг'),
    bio: text(input.bio, 'Подходите спокойно, без резких движений.'),
    social: socialLabels[rawSocial] ?? rawSocial,
    triggers: text(input.triggers),
    area: text(input.area, 'район скрыт'),
    image: safePublicImage(input.image),
  };
}

export function publicDogCardFieldsFromRow(row: any): PublicDogCardFields {
  const fields = row?.fields && typeof row.fields === 'object' ? row.fields as Record<string, unknown> : {};
  const firstTrait = Array.isArray(row?.traits) ? row.traits[0] : undefined;
  return normalizePublicDogCardFields({
    ...fields,
    name: fields.name ?? row?.title,
    breed: fields.breed ?? row?.subtitle,
    character: fields.character ?? firstTrait,
  });
}
