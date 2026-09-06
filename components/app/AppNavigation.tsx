'use client';

import { Button } from '@/components/ui/Button';
import { Sparkle, House, Dog, MapTrifold, ChatCircleDots, ShoppingBag } from '@phosphor-icons/react';

export type PrimaryRoute = 'today' | 'profile' | 'map' | 'nearby' | 'things';

type PetIconName = 'home' | 'paw' | 'map' | 'nearby' | 'bag';

const routes: { id: PrimaryRoute; label: string; icon: PetIconName }[] = [
  { id: 'today', label: 'Главная', icon: 'home' },
  { id: 'profile', label: 'Профиль', icon: 'paw' },
  { id: 'map', label: 'Карта', icon: 'map' },
  { id: 'nearby', label: 'Гав', icon: 'nearby' },
  { id: 'things', label: 'Вещи', icon: 'bag' },
];

function PetNavIcon({ name }: { name: PetIconName }) {
  const Icon = { home: House, paw: Dog, map: MapTrifold, nearby: ChatCircleDots, bag: ShoppingBag }[name];
  return <Icon weight="regular" aria-hidden="true" />;
}

export function AppNavigation({
  active,
  dogName,
  onNavigate,
  onAskAssistant,
}: {
  active: string;
  dogName?: string;
  onNavigate: (route: PrimaryRoute) => void;
  onAskAssistant?: () => void;
}) {
  return (
    <nav className="app-tabs" aria-label="Основные разделы">
      <div className="app-tabs-brand" aria-hidden="true">
        <b>Псё</b>
        <span>ваш день вместе</span>
      </div>
      {routes.map((route) => {
        const isActive = active === route.id;
        return (
          <Button
            key={route.id}
            variant="nav"
            size="md"
            onClick={() => onNavigate(route.id)}
            className={isActive ? 'active' : ''}
            aria-current={isActive ? 'page' : undefined}
            data-route={route.id}
          >
            <span className="app-tab-icon" aria-hidden="true">
              <PetNavIcon name={route.icon} />
            </span>
            <span>{route.id === 'profile' && dogName ? dogName : route.label}</span>
          </Button>
        );
      })}
      {onAskAssistant && <button className="app-tabs-assistant" type="button" aria-label="Спросить Псё" onClick={onAskAssistant}>
        <Sparkle weight="fill" aria-hidden="true" />
        <span><b>Спросить Псё</b><small>Помощник по данным собаки</small></span>
      </button>}
    </nav>
  );
}
