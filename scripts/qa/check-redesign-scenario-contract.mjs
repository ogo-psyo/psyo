import { readFileSync } from 'node:fs';

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function requireText(text, marker, label) {
  if (!text.includes(marker)) throw new Error(`${label}: missing ${marker}`);
}

function rejectText(text, marker, label) {
  if (text.includes(marker)) throw new Error(`${label}: found forbidden ${marker}`);
}

const layout = source('app/layout.tsx');
const page = source('app/page.tsx');
const journey = source('components/journey/ProductionJourney.tsx');
const profile = source('components/profile/ProfileMemoryWorkspace.tsx');
const social = source('components/social/ProductionWoofWorkspace.tsx');
const map = source('components/journey/ProductionMapWorkspace.tsx');
const bootstrap = source('app/api/app/bootstrap/route.ts');
const health = source('components/health/HealthTimelineScreen.tsx');

requireText(layout, "import './editorial.css'", 'single active visual system');
rejectText(layout, "import './redesign.css'", 'retired visual layer');
requireText(layout, 'living-field-guide-2026-08', 'approved design contract');
requireText(journey, "type ScenarioId = 'health' | 'care' | 'handoff'", 'guided scenario service');
requireText(journey, 'data-scenario-workspace', 'scenario workspace');
requireText(journey, 'data-observation-timeline', 'shared observation timeline');
requireText(journey, 'Нужна ещё одна запись', 'honest insufficient-data state');
rejectText(journey, 'all-scenario-current', 'retired nearest-care card');
rejectText(journey, 'all-observation-grid', 'retired sparkline grid');
rejectText(page, "tab === 'assistant'", 'single assistant surface');
rejectText(page, 'false && hasDog', 'dead duplicate screen');
rejectText(page, 'Boolean(0)', 'dead duplicate screen');
requireText(page, '<ProductionAssistantSheet', 'assistant sheet');
requireText(journey, 'error?: string', 'assistant in-context failure');
requireText(page, "state: 'loading'", 'assistant action loading state');
requireText(page, "state: 'success'", 'assistant action success state');
requireText(page, "state: 'error'", 'assistant action recovery state');
requireText(page, 'navigateFromAssistant(action.destination', 'assistant typed destination routing');
requireText(page, "overlay: 'assistant'", 'assistant Back integration');
requireText(page, 'openJourneyDetail', 'detail Back integration');
requireText(profile, 'onOpenPlan', 'mobile profile plan reachability');
requireText(profile, 'onOpenHabits', 'mobile profile habits reachability');
requireText(profile, 'onOpenCard', 'mobile public-card reachability');
requireText(profile, 'onOpenSettings', 'mobile settings reachability');
requireText(social, 'inviteState', 'active incoming invite states');
requireText(social, 'onAcceptInvite', 'active incoming invite action');
requireText(social, "useState<'live' | 'meet'>('live')", 'Гав opens on live map discovery');
requireText(social, 'aria-label="Фильтры поиска на карте"', 'live map search filters');
requireText(social, 'onChangeViewerRadius', 'live map radius control');
requireText(page, "signalParams.set('radiusKm'", 'live map radius reaches server discovery');
requireText(social, "filtersOpen ? 'Свернуть фильтры' : 'Показать фильтры'", 'filter disclosure names its state');
requireText(map, 'petId: string', 'pet-scoped map route');
requireText(map, 'pso.map.active-route.v3:${petId}', 'pet-scoped map storage');
requireText(page, "nextUrl.hash = 'today'", 'pet switch route reset');
rejectText(page, 'wishlistHints', 'fabricated wishlist recommendation');
rejectText(page, 'todayPlan', 'fabricated care plan');
requireText(bootstrap, ".from('pet_observations')", 'observation bootstrap');
requireText(bootstrap, ".is('deleted_at', null)", 'recoverable-delete filter');
requireText(bootstrap, "select('active_pet_id')", 'persisted active pet');
requireText(health, '<ObservationEditor', 'observation edit lifecycle');
requireText(health, 'onDelete', 'observation delete lifecycle');
rejectText(profile, "surface === 'health'", 'single Health surface');

console.log('redesign scenario contract: ok');
