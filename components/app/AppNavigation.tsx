'use client';

import styles from './ConnectedShell.module.css';
import { Button } from '@/components/ui/Button';
import { Sparkle, House, Dog, MapTrifold, ChatCircleDots, SquaresFour } from '@phosphor-icons/react';

export type PrimaryRoute = 'today' | 'profile' | 'map' | 'nearby' | 'all';

type PetIconName = 'home' | 'paw' | 'map' | 'nearby' | 'bag';

const routes: { id: PrimaryRoute; label: string; icon: PetIconName }[] = [
  { id: 'today', label: 'Псё', icon: 'home' },
  { id: 'map', label: 'Карта', icon: 'map' },
  { id: 'nearby', label: 'Гав', icon: 'nearby' },
  { id: 'all', label: 'Всё', icon: 'bag' },
  { id: 'profile', label: 'Профиль', icon: 'paw' },
];

function PetNavIcon({ name }: { name: PetIconName }) {
  const Icon = { home: House, paw: Dog, map: MapTrifold, nearby: ChatCircleDots, bag: SquaresFour }[name];
  return <Icon weight="regular" aria-hidden="true" />;
}

export function AppNavigation({
  active,
  onNavigate,
  onAskAssistant,
}: {
  active: string;
  dogName?: string;
  onNavigate: (route: PrimaryRoute) => void;
  onAskAssistant?: () => void;
}) {
  return (
    <nav className={`app-tabs ${styles.navigation}`} data-connected-navigation aria-label="Основные разделы">
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
            <span>{route.label}</span>
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
