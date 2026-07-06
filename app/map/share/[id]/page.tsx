import Link from 'next/link';
import type { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/server/supabase';

export const metadata: Metadata = {
  title: 'Место по ссылке — Псё',
  description: 'Безопасная публичная страница места или маршрута, которым поделился владелец.',
};

type SharedMapItem = {
  id: string;
  kind: 'point' | 'route';
  title: string;
  description: string;
  label: string;
  tone: string;
};

const zoneLabels: Record<string, string> = {
  safe_place: 'спокойное место',
  risk_zone: 'зона риска',
  clinic: 'ветклиника',
  shop: 'магазин',
  grooming: 'груминг',
  walk_route: 'маршрут прогулки',
  home_area: 'домашний район',
};

function cleanText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

async function findSharedMapItem(id: string): Promise<SharedMapItem | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data: route } = await supabase
    .from('map_routes')
    .select('id, title, description, color, visibility, moderation_status')
    .eq('id', id)
    .eq('visibility', 'shared')
    .maybeSingle();

  if (route) {
    return {
      id: route.id,
      kind: 'route',
      title: cleanText(route.title, 'Маршрут прогулки'),
      description: cleanText(route.description, 'Владелец поделился маршрутом без точных координат на публичной странице.'),
      label: 'маршрут по ссылке',
      tone: cleanText(route.color, '#3b82f6'),
    };
  }

  const { data: zone } = await supabase
    .from('map_zones')
    .select('id, title, note, type, visibility, moderation_status')
    .eq('id', id)
    .eq('visibility', 'shared')
    .maybeSingle();

  if (!zone) return null;

  return {
    id: zone.id,
    kind: 'point',
    title: cleanText(zone.title, 'Место для собаки'),
    description: cleanText(zone.note, 'Владелец поделился местом без точного адреса и приватных деталей.'),
    label: zoneLabels[zone.type] || 'место по ссылке',
    tone: zone.type === 'risk_zone' ? '#ef4444' : '#2f985a',
  };
}

export default async function MapSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await findSharedMapItem(id);

  if (!item) {
    return (
      <main className="share-page map-share-page">
        <section className="share-card map-share-card">
          <div className="card-top">
            <span>Псё</span>
            <b>ссылка недоступна</b>
          </div>
          <div className="map-share-hero">
            <span>privacy first</span>
            <h1>Место не открыто</h1>
            <p>Ссылка могла быть удалена, стать приватной или ожидать модерации.</p>
          </div>
          <div className="share-safety-stack">
            <div className="share-approach">
              <span>безопасность</span>
              <b>Приватная карта не раскрывается</b>
              <p>Точные координаты, домашние зоны и личные заметки не показываются по публичной ссылке.</p>
            </div>
          </div>
          <Link className="share-create-link" href="/">Открыть Псё</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="share-page map-share-page">
      <section className="share-card map-share-card">
        <div className="card-top">
          <span>Псё</span>
          <b>{item.kind === 'route' ? 'маршрут' : 'место'}</b>
        </div>

        <div className="map-share-hero" style={{ ['--map-share-tone' as string]: item.tone }}>
          <span>{item.label}</span>
          <h1>{item.title}</h1>
          <p>{item.description}</p>
        </div>

        <div className="share-safety-stack" aria-label="Приватность места по ссылке">
          <div className="share-approach">
            <span>что видно</span>
            <b>Только безопасное описание</b>
            <p>Эта страница не показывает точные координаты, владельца, домашний адрес или приватные заметки.</p>
          </div>

          <div className="share-place">
            <span>статус ссылки</span>
            <b>Открыто только по ссылке</b>
          </div>
        </div>

        <p className="privacy-hint">Псё показывает только безопасное описание места. Детальная география остаётся у владельца.</p>
        <Link className="share-create-link" href="/">Создать место в Псё</Link>
      </section>
    </main>
  );
}
