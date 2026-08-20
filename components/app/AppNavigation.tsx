'use client';

import { Button } from '@/components/ui/Button';

export type PrimaryRoute = 'today' | 'profile' | 'map' | 'nearby' | 'things';

type PetIconName = 'home' | 'paw' | 'map' | 'nearby' | 'bag';

const routes: { id: PrimaryRoute; label: string; icon: PetIconName }[] = [
  { id: 'today', label: 'всё', icon: 'home' },
  { id: 'profile', label: 'псё', icon: 'paw' },
  { id: 'map', label: 'карта', icon: 'map' },
  { id: 'nearby', label: 'гав', icon: 'nearby' },
  { id: 'things', label: 'вещи', icon: 'bag' },
];

// Streamline Plump via Iconify, CC BY 4.0.
function PetNavIcon({ name }: { name: PetIconName }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 3 };

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      {name === 'home' && <path {...common} d="M26.815 4.16c7.235 3.211 12.719 7.43 15.554 9.867 1.433 1.232 2.232 3.005 2.33 4.892C44.836 21.51 45 25.565 45 30c0 3.412-.097 6.706-.204 9.293a5.69 5.69 0 0 1-5.512 5.47C35.824 44.882 30.689 45 24 45S12.177 44.882 8.716 44.764a5.69 5.69 0 0 1-5.512-5.47A230 230 0 0 1 3 30c0-4.435.165-8.49.3-11.081.1-1.887.898-3.66 2.331-4.892 2.835-2.438 8.32-6.656 15.554-9.867a6.94 6.94 0 0 1 5.63 0M16 38h16" />}
      {name === 'paw' && <path {...common} d="M24 20c-6.334 0-11.686 5.531-13.414 12.635-.76 3.124.386 6.44 3.199 7.998C16.015 41.868 19.332 43 24 43s7.986-1.132 10.216-2.367c2.813-1.558 3.958-4.874 3.198-7.998C35.686 25.53 30.334 20 24 20M3 18.444C3 21.206 4.79 24 7 24s4-2.794 4-5.556S9.21 14 7 14s-4 1.683-4 4.444m42 0C45 21.206 43.21 24 41 24s-4-2.794-4-5.556S38.79 14 41 14s4 1.683 4 4.444m-31.5-9c0 2.762 1.79 5.556 4 5.556s4-2.794 4-5.556S19.71 5 17.5 5s-4 1.683-4 4.444m21 0c0 2.762-1.79 5.556-4 5.556s-4-2.794-4-5.556S28.29 5 30.5 5s4 1.683 4 4.444" />}
      {name === 'map' && <path {...common} d="M16.84 5c-4.587.609-8.783 1.998-11.205 2.917-1.349.512-2.229 1.77-2.305 3.21C3.19 13.781 3 18.706 3 25.9c0 6.878.174 11.682.312 14.41.067 1.341 1.427 2.189 2.694 1.744C12.036 39.936 16.84 39.2 16.84 39.2 24 40.15 31.159 43 31.159 43c4.588-.609 8.784-1.998 11.206-2.917 1.349-.512 2.229-1.77 2.305-3.21.14-2.655.33-7.579.33-14.773 0-6.878-.174-11.682-.312-14.41-.067-1.341-1.427-2.189-2.694-1.744C35.964 8.064 31.16 8.8 31.16 8.8 24 5.95 16.841 5 16.841 5Zm-.19 34.151V5.126m14.7 3.724v34.025" />}
      {name === 'nearby' && <g {...common}><path d="M42 21c0 12.919-13.35 22.128-17.056 24.436a1.77 1.77 0 0 1-1.888 0C19.351 43.128 6 33.919 6 21c0-9.941 8.059-18 18-18s18 8.059 18 18" /><path d="M32.942 23.822a7.2 7.2 0 0 0 .873-5.38c-.911-4.163-5.957-5.864-9.1-3.074-.249.22-.47.473-.715.725-.245-.252-.466-.506-.715-.725-3.143-2.79-8.189-1.089-9.1 3.074a7.2 7.2 0 0 0 .873 5.38c1.592 2.58 4.09 4.63 6.597 6.48a3.96 3.96 0 0 0 4.69 0c2.508-1.85 5.005-3.9 6.597-6.48" /></g>}
      {name === 'bag' && <g {...common}><path d="M14.823 3.653C13.744 3.824 13 4.766 13 5.86a7.14 7.14 0 0 0 4.37 6.583C9.581 15.882 4 24.837 4 32.25 4 41.639 12.954 45 24 45s20-3.361 20-12.75c0-7.413-5.583-16.368-13.37-19.808A7.14 7.14 0 0 0 35 5.859c0-1.093-.744-2.035-1.823-2.206C31.357 3.364 28.225 3 24 3s-7.358.364-9.177.653" /><path d="M17 12.5s3 .5 7 .5 7-.5 7-.5" /></g>}
    </svg>
  );
}

export function AppNavigation({
  active,
  onNavigate,
}: {
  active: string;
  onNavigate: (route: PrimaryRoute) => void;
}) {
  return (
    <nav className="app-tabs" aria-label="Основные разделы">
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
    </nav>
  );
}
