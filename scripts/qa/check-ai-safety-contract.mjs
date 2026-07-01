import fs from 'fs';

const routePath = 'app/api/assistant/route.ts';
const apiContent = fs.readFileSync(routePath, 'utf-8');
const lowerContent = apiContent.toLowerCase();

const requiredBlocklistTerms = ['диагноз', 'дозировка', 'антибиотик'];
const requiredSafetyMarkers = [
  'MEDICAL_SAFETY_BLOCKLIST',
  'hasMedicalSafetyTerm',
  "safetyFlag: 'vet_boundary'",
  "safety: 'no_diagnosis'",
  'ветеринар',
];

let passed = true;

for (const term of requiredBlocklistTerms) {
  if (!lowerContent.includes(term)) {
    console.error(`AI safety check failed: term "${term}" is missing from assistant safety logic.`);
    passed = false;
  }
}

for (const marker of requiredSafetyMarkers) {
  if (!apiContent.includes(marker)) {
    console.error(`AI safety check failed: marker "${marker}" is missing in ${routePath}.`);
    passed = false;
  }
}

if (!passed) {
  process.exit(1);
}

console.log('AI safety blocklist is present.');
