'use client';

export type PrimaryRoute = 'today' | 'calendar' | 'card' | 'profile';

const routes: { id: PrimaryRoute; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'calendar', label: 'План' },
  { id: 'card', label: 'Памятка' },
  { id: 'profile', label: 'Профиль' },
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
        >
          {route.label}
        </button>
      ))}
    </nav>
  );
}
