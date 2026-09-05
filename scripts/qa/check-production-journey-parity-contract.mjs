import { readFileSync } from 'node:fs';

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function requireText(text, marker, label) {
  if (!text.includes(marker)) throw new Error(`${label}: missing ${marker}`);
}

function rejectText(text, marker, label) {
  if (text.includes(marker)) throw new Error(`${label}: found removed ${marker}`);
}

const page = source('app/page.tsx');
const shell = source('components/journey/ProductionJourney.tsx');
const home = source('components/profile/ProductionHome.tsx');
const profileMemory = source('components/profile/ProfileMemoryWorkspace.tsx');
const css = source('components/journey/production-journey.css');
const globals = source('app/globals.css');

requireText(page, "from '@/components/journey/ProductionJourney'", 'production root');
requireText(page, '<ProductionHome', 'production route today');
for (const route of ['map', 'nearby', 'things']) {
  requireText(page, `<ProductionJourney route="${route}"`, `production route ${route}`);
}
requireText(page, '<ProfileMemoryWorkspace', 'production profile memory route');
requireText(page, '<ProductionAssistantSheet', 'assistant overlay');
requireText(home, 'data-home-today', 'useful Today summary');
requireText(home, 'data-home-snapshot', 'real Today snapshot');
requireText(page, 'observations={observations.map', 'Today real-event data');
requireText(home, 'recommendationSlot', 'Today recommendation service');
rejectText(shell, 'v3-orbit-bubble', 'non-interactive Today badges');
requireText(shell, 'data-scenario-workspace="social"', 'guided Gav scenario workspace');
requireText(shell, "onClick={() => props.onNavigate('nearby')}>Открыть Гав", 'guided Gav scenario action');
requireText(profileMemory, 'data-profile-memory', 'accepted profile memory composition');
requireText(profileMemory, 'onOpenHealth', 'profile health entry point');
requireText(page, '<HealthTimelineScreen', 'single health drill-down');
requireText(profileMemory, "surface === 'character'", 'profile character drill-down');
requireText(profileMemory, "surface === 'social'", 'profile social drill-down');
requireText(shell, 'production-journey-map', 'accepted live map composition');
requireText(shell, 'production-journey-woof', 'accepted Гав composition');
requireText(shell, 'Покажем профиль тем, кто тоже ищет компанию поблизости.', 'gender-neutral Гав copy');
rejectText(shell, 'Покажем {props.dogName}', 'uninflected dog name in Гав copy');
requireText(css, '.production-journey-avatar .avatar-placeholder b', 'compact avatar label guard');
requireText(shell, 'production-journey-shelf', 'accepted Things composition');
requireText(shell, 'map?: ReactNode', 'real map slot');
requireText(globals, "@import '../components/journey/production-journey.css';", 'shared production style');
requireText(css, '#cbfedb', 'approved mint');
requireText(css, '#98df73', 'approved green');
requireText(css, '#3df881', 'approved signal');
requireText(css, '#07814d', 'approved emerald');
requireText(css, '#dd617c', 'approved coral');

console.log('production journey parity contract: ok');
