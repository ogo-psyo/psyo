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
const css = source('components/journey/production-journey.css');
const globals = source('app/globals.css');

requireText(page, "from '@/components/journey/ProductionJourney'", 'production root');
for (const route of ['today', 'profile', 'map', 'nearby', 'things']) {
  requireText(page, `<ProductionJourney route="${route}"`, `production route ${route}`);
}
requireText(page, '<ProductionAssistantSheet', 'assistant overlay');
requireText(shell, 'production-today-summary', 'useful Today summary');
requireText(shell, 'production-today-history', 'real Today history');
requireText(page, 'profileEntries={profileJourneyEntries}', 'Today real-event data');
rejectText(shell, 'v3-orbit-bubble', 'non-interactive Today badges');
rejectText(shell, 'Открыть Гав', 'duplicate Today navigation');
requireText(shell, 'profile-life-card', 'accepted profile composition');
requireText(shell, 'data-slot="card"', 'structured profile card');
requireText(shell, 'data-slot="item-group"', 'structured profile actions');
requireText(shell, 'production-journey-map', 'accepted live map composition');
requireText(shell, 'production-journey-woof', 'accepted Гав composition');
requireText(shell, 'production-journey-shelf', 'accepted Things composition');
requireText(shell, 'map?: ReactNode', 'real map slot');
requireText(globals, "@import '../components/journey/production-journey.css';", 'shared production style');
requireText(css, '#cbfedb', 'approved mint');
requireText(css, '#98df73', 'approved green');
requireText(css, '#3df881', 'approved signal');
requireText(css, '#07814d', 'approved emerald');
requireText(css, '#dd617c', 'approved coral');

console.log('production journey parity contract: ok');
