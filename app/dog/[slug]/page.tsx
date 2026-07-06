import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DogCardActions } from './DogCardActions';
import { publicDogCardFieldsFromRow } from '@/lib/server/publicDogCard';
import { getSupabaseAdmin } from '@/lib/server/supabase';

export const metadata: Metadata = {
  title: 'Памятка собаки — Псё',
  description: 'Короткая памятка для человека, который гуляет или сидит с собакой.',
};

export default async function DogCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const read = (key: string, fallback: string) => {
    const value = query[key];
    return typeof value === 'string' && value.trim() ? value : fallback;
  };
  const displayMap: Record<string, string> = {
    ok: 'можно знакомиться',
    ask_first: 'сначала спросить',
    calm_dogs_only: 'только спокойные собаки',
    do_not_approach: 'лучше не подходить',
    known_only: 'только свои',
    unknown: 'не указано',
  };
  const cleanDisplay = (value: string, fallback: string) => {
    const clean = value.trim();
    if (!clean) return fallback;
    return displayMap[clean] ?? clean.replaceAll('_', ' ');
  };
  const contactCopy: Record<string, { title: string; detail: string }> = {
    ok: {
      title: 'Можно поздороваться',
      detail: 'Подходите спокойно, лучше сбоку. Без резких рук и нависания сверху.',
    },
    ask_first: {
      title: 'Сначала спросите хозяина',
      detail: 'Окликните человека и дождитесь “можно”. Руки к морде не тяните.',
    },
    calm_dogs_only: {
      title: 'Только спокойно и по одному',
      detail: 'Без толпы, рывков и подбегающих собак. Дайте время освоиться.',
    },
    do_not_approach: {
      title: 'Лучше не подходить',
      detail: 'Просто пройдите мимо спокойно. Не гладьте и не зовите к себе.',
    },
    known_only: {
      title: 'Общается только со своими',
      detail: 'Если вы не знакомы, держите дистанцию и не пытайтесь знакомить собак.',
    },
  };

  const supabase = getSupabaseAdmin();
  const persisted = supabase ? await supabase
    .from('dog_cards')
    .select('title, subtitle, traits, fields, visibility, public_slug, revoked_at')
    .eq('public_slug', slug)
    .in('visibility', ['unlisted', 'public'])
    .is('revoked_at', null)
    .maybeSingle() : null;
  const dbFields = persisted?.data ? publicDogCardFieldsFromRow(persisted.data) : null;
  if (slug !== 'card' && !dbFields) notFound();

  const name = cleanDisplay(dbFields?.name || read('name', 'Собака'), 'Собака');
  const breed = cleanDisplay(dbFields?.breed || read('breed', 'Метис / не знаю'), 'Метис / не знаю');
  const character = cleanDisplay(dbFields?.character || read('character', read('style', 'спокойный, любопытный')), 'спокойный, любопытный');
  const bio = cleanDisplay(dbFields?.bio || read('bio', 'Можно знакомиться спокойно и без резких движений.'), 'Можно знакомиться спокойно и без резких движений.');
  const rawSocial = (dbFields?.social || read('social', 'ask_first')).trim();
  const socialKey = displayMap[rawSocial] ? rawSocial : Object.entries(displayMap).find(([, label]) => label === rawSocial)?.[0] || '';
  const social = contactCopy[socialKey]?.title || cleanDisplay(rawSocial, 'Сначала спросите хозяина');
  const socialDetail = contactCopy[socialKey]?.detail || 'Подойдите спокойно и сначала уточните у человека рядом.';
  const area = cleanDisplay(dbFields?.area || read('area', 'район скрыт'), 'район скрыт');
  const triggers = cleanDisplay(dbFields?.triggers || read('triggers', ''), '');
  const demo = read('demo', '0') === '1';
  const rawImage = dbFields?.image || read('image', '');
  const image = /^(https?:\/\/|data:image\/(png|jpe?g|webp);base64,)/i.test(rawImage) ? rawImage : '';
  const avoidText = triggers || (bio.toLowerCase() === social.toLowerCase()
    ? 'резкие движения, шум, руки к морде'
    : bio);

  return (
    <main className="share-page">
      <section className="share-card">
        <div className="card-top">
          <span>Псё</span>
          <b>{demo ? 'пример памятки' : 'памятка для человека'}</b>
        </div>

        <div className="share-hero">
          <div className={`share-avatar ${image ? 'has-image' : ''}`} aria-label={`Фото собаки ${name}`}>
            {image && <img src={image} alt="" />}
          </div>
          <div className="share-hero-glass">
            <span>собака</span>
            <h1>{name}</h1>
            <p>{breed}</p>
          </div>
        </div>

        <div className="share-safety-stack" aria-label="Правила контакта с собакой">
          <div className="share-approach">
            <span>главное правило</span>
            <b>{social}</b>
            <p>{socialDetail}</p>
          </div>

          <div className="share-character">
            <span>характер</span>
            <b>{character}</b>
          </div>

          <div className="share-avoid">
            <span>не делать</span>
            <b>{avoidText}</b>
          </div>

          <div className="share-place">
            <span>район без точного адреса</span>
            <b>{area}</b>
          </div>
        </div>

        <DogCardActions name={name} />
        <Link className="share-create-link" href="/">Создать карточку своей собаки</Link>
      </section>
    </main>
  );
}
