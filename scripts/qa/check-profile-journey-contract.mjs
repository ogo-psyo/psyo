import fs from 'node:fs';

const component = fs.readFileSync('components/journey/ProductionJourney.tsx', 'utf8');
const page = fs.readFileSync('app/page.tsx', 'utf8');

const componentRequirements = [
  'export type JourneyProfileEntry',
  'profileEntries?: JourneyProfileEntry[]',
  'onAddDocument?: (trigger: HTMLButtonElement) => void',
  'onEditProfile?: () => void',
  'onAddObservation?: () => void',
  'data-profile-journey-action="add-document"',
  'data-profile-wellbeing',
  'Динамика самочувствия',
  'profile-wellbeing-chart',
  'Постоянное о собаке',
  'data-slot="card"',
  'data-slot="item-group"',
  'export function ProductionDocumentSheet',
  'data-slot="sheet-content"',
];

for (const requirement of componentRequirements) {
  if (!component.includes(requirement)) throw new Error(`Profile journey component is missing: ${requirement}`);
}

const pageRequirements = [
  'profileEntries={profileJourneyEntries}',
  'onAddDocument={(trigger) => { documentUploadTriggerRef.current = trigger; setDocumentFileName(\'\'); setDocumentUploadOpen(true); }}',
  'onEditProfile={() => setJourneyDetail(\'profile\')}',
  'onAddObservation={() => setTab(\'health\')}',
  '<ProductionDocumentSheet',
  'className="document-field-control"',
  'className="document-file-drop"',
  'data-document-file-name',
  'Добавить в историю',
];

for (const requirement of pageRequirements) {
  if (!page.includes(requirement)) throw new Error(`Profile journey wiring is missing: ${requirement}`);
}

console.log('profile journey contract: ok');
