import type { Pet, SocialProfile } from './domain';
import { bucketDistance } from './geo';

export interface MatchResult {
  score: number;
  reasons: string[];
  safetyWarnings: string[];
  blurredDistance: string;
}

type MatchDog = Pet & {
  social: SocialProfile & {
    preferredSizes?: string[];
    preferred_sizes?: string[];
  };
};

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function dogSize(dog: MatchDog) {
  const raw = dog as any;
  const explicit = raw.size ?? raw.size_group;
  if (explicit) return String(explicit);
  const weight = Number(raw.weightKg ?? raw.weight_kg);
  if (!Number.isFinite(weight)) return undefined;
  if (weight < 10) return 'small';
  if (weight < 25) return 'medium';
  return 'large';
}

function energyLevel(dog: MatchDog) {
  const raw = dog as any;
  return raw.energy ?? raw.energyLevel ?? raw.energy_level ?? dog.social?.energyLevel ?? (dog.social as any)?.energy_level;
}

function temperament(dog: MatchDog) {
  const raw = dog as any;
  return raw.temperament ?? dog.social?.temperament;
}

function preferredSizes(dog: MatchDog) {
  const social = dog.social as any;
  return list(social.preferredSizes ?? social.preferred_sizes);
}

function sharedTriggers(myDog: MatchDog, candidate: MatchDog) {
  const mine = new Set(list(myDog.social?.triggers).map((item) => item.toLowerCase()));
  return list(candidate.social?.triggers).filter((trigger) => mine.has(trigger.toLowerCase()));
}

export function calculateCompatibility(
  myDog: MatchDog,
  candidate: MatchDog,
  distanceMeters: number,
): MatchResult | null {
  let score = 50;
  const reasons: string[] = [];
  const safetyWarnings: string[] = [];
  const overlap = sharedTriggers(myDog, candidate);

  if (overlap.length > 0) {
    return null;
  }

  const mySize = dogSize(myDog);
  const candidateSize = dogSize(candidate);
  if (mySize && candidateSize && mySize === candidateSize) {
    score += 20;
    reasons.push('Одинаковый размер');
  } else if (candidateSize && preferredSizes(myDog).includes(candidateSize)) {
    score += 10;
    reasons.push('Соответствует предпочтениям по размеру');
  }

  const myEnergy = energyLevel(myDog);
  const candidateEnergy = energyLevel(candidate);
  if (myEnergy && candidateEnergy && myEnergy === candidateEnergy) {
    score += 15;
    reasons.push('Похожий уровень энергии');
  }

  if (temperament(candidate) === 'reactive' && temperament(myDog) !== 'calm') {
    safetyWarnings.push('Собака может быть реактивной, рекомендована параллельная прогулка на дистанции');
    score -= 10;
  }

  if (!reasons.length) {
    reasons.push('Можно начать с короткой параллельной прогулки и проверить реакцию');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
    safetyWarnings,
    blurredDistance: bucketDistance(distanceMeters),
  };
}
