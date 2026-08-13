'use client';

export type PrimaryRoute = 'today' | 'profile' | 'map' | 'nearby' | 'things';

const routes: { id: PrimaryRoute; label: string }[] = [
  { id: 'today', label: 'всё' },
  { id: 'profile', label: 'псё' },
  { id: 'map', label: 'карта' },
  { id: 'nearby', label: 'рядом' },
  { id: 'things', label: 'вещи' },
];

export function AppNavigation({
  active,
  onNavigate,
}: {
  active: string;
  onNavigate: (route: PrimaryRoute) => void;
}) {
  return (
    <nav className="app-tabs" aria-label="Основные разделы">
      {routes.map((route) => (
        <button
          key={route.id}
          type="button"
          onClick={() => onNavigate(route.id)}
          className={active === route.id ? 'active' : ''}
          aria-current={active === route.id ? 'page' : undefined}
          data-route={route.id}
        >
          {route.label}
        </button>
      ))}
    </nav>
  );
}
