import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Карточка собаки — Псё',
  description: 'Публичная карточка собаки в Псё.',
};

export default async function DogCardPage({
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const read = (key: string, fallback: string) => {
    const value = query[key];
    return typeof value === 'string' && value.trim() ? value : fallback;
  };

  const name = read('name', 'Собака');
  const breed = read('breed', 'Метис / не знаю');
  const style = read('style', 'городской исследователь');
  const bio = read('bio', 'Можно знакомиться спокойно и без резких движений.');
  const social = read('social', 'можно знакомиться');
  const area = read('area', 'район скрыт');
  const demo = read('demo', '0') === '1';

  return (
    <main className="share-page">
      <section className="share-card">
        <div className="card-top"><span>Псё карточка</span><b>{demo ? 'DEMO' : 'PUBLIC'}</b></div>
        <div className="share-avatar" aria-hidden="true">
          <span className="share-dog"><span /><i /><b /></span>
        </div>
        <h1>{name}</h1>
        <p>{breed} · {style}</p>
        <blockquote>{bio}</blockquote>
        <div className="trait-grid">
          <span>{social}</span>
          <span>{area}</span>
          <span>без точной геолокации</span>
        </div>
        <Link className="primary" href="/">Создать карточку своей собаки</Link>
      </section>
    </main>
  );
}
