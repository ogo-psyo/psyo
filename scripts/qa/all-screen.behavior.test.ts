import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const journey = readFileSync('components/journey/ProductionJourney.tsx', 'utf8');
const home = readFileSync('components/profile/ProductionHome.tsx', 'utf8');
const page = readFileSync('app/page.tsx', 'utf8');

for (const marker of [
  'data-production-home',
  'data-home-today',
  'data-home-primary',
  'data-home-secondary',
  'data-home-scenarios',
  'data-home-snapshot',
  'Как {dogName}',
  'Спросить своими словами',
  'Изменилось самочувствие',
  'Организовать уход',
  'Найти компанию на прогулку',
  'Передать собаку другому',
  'Открыть карту «Гав»',
  'data-home-capture',
]) assert.ok(home.includes(marker), `screen «Всё» must expose: ${marker}`);

assert.ok(home.includes('setCaptureOpen(true)'), 'observation composer must open capture directly');
assert.ok(home.includes('voiceCapture'), 'voice capture must stay inside the home input section');

for (const marker of [
  'observations={observations.map',
  'onOpenCare={() =>',
  'onOpenCard={() => setTab(\'card\')}',
  "onNavigate={(route) => {",
]) assert.ok(page.includes(marker), `screen «Всё» must connect real product action: ${marker}`);

assert.ok(!page.includes("onAddObservation={() => setTab('health')}"), 'observation input must not redirect away from the All screen');

assert.ok(home.includes("onNavigate('nearby')"), 'Gav scenario must open the real social workspace');

assert.ok(page.includes("const preserveLocalGuest = payload.mode === 'demo'"), 'anonymous demo bootstrap must preserve local observations used by charts');

assert.ok(!home.includes('Что нужно решить?'), 'old abstract decision heading must not remain the home hierarchy');
assert.ok(!journey.includes('all-scenario-current'), 'scenario service must not duplicate the nearest-care card');
assert.ok(!journey.includes('all-scenario-list'), 'scenario service must not degrade into a navigation list');
assert.ok(!journey.includes('all-observation-grid'), 'observations must use one shared timeline instead of a grid of sparklines');

console.log('all screen information architecture behavior ok');
