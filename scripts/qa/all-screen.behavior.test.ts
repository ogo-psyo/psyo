import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const journey = readFileSync('components/journey/ProductionJourney.tsx', 'utf8');
const page = readFileSync('app/page.tsx', 'utf8');

for (const marker of [
  'data-all-profile',
  'data-all-scenarios',
  'data-all-observation-trends',
  'Открыть Псё',
  'Что нужно решить?',
  'Опишите своими словами',
  'data-scenario-workspace',
  'Изменилось самочувствие',
  'Организовать уход',
  'Найти компанию на прогулку',
  'Передать собаку другому',
  'Наблюдения',
  'data-observation-composer',
  'Рассказать о состоянии',
  'data-observation-timeline',
]) assert.ok(journey.includes(marker), `screen «Всё» must expose: ${marker}`);

assert.ok(journey.includes("setObservationCaptureOpen(true)"), 'observation composer must open capture directly');
assert.ok(journey.includes('all-observation-capture'), 'voice capture must stay inside the observation input section');

for (const marker of [
  'observationPoints={observations.map',
  'onOpenCare={() =>',
  'onOpenCard={() => setTab(\'card\')}',
  "onNavigate={(route) => {",
]) assert.ok(page.includes(marker), `screen «Всё» must connect real product action: ${marker}`);

assert.ok(!page.includes("onAddObservation={() => setTab('health')}"), 'observation input must not redirect away from the All screen');

assert.ok(journey.includes("props.onNavigate('nearby')"), 'Gav scenario must open the real social workspace');

assert.ok(page.includes("const preserveLocalGuest = payload.mode === 'demo'"), 'anonymous demo bootstrap must preserve local observations used by charts');

assert.ok(!journey.includes('<Header dogName={props.dogName} title={`${props.dogName} сегодня`}'), 'old day-summary header must not remain the All-screen hierarchy');
assert.ok(!journey.includes('all-scenario-current'), 'scenario service must not duplicate the nearest-care card');
assert.ok(!journey.includes('all-scenario-list'), 'scenario service must not degrade into a navigation list');
assert.ok(!journey.includes('all-observation-grid'), 'observations must use one shared timeline instead of a grid of sparklines');

console.log('all screen information architecture behavior ok');
