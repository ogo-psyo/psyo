'use client';

import type { SocialCandidate, SocialScenario } from '@/lib/socialCore';

const scenarioLabels: Record<SocialScenario, string> = {
  meet: 'знакомство',
  walk: 'прогулка',
  socialize: 'социализация',
  mating: 'случка',
};

export function CandidateCard({
  candidate,
  requestStatus,
  busy,
  onRequest,
}: {
  candidate: SocialCandidate;
  requestStatus?: string;
  busy: boolean;
  onRequest: (scenario: SocialScenario) => void;
}) {
  const scenario = candidate.sharedScenarios[0];
  const pending = requestStatus === 'pending';
  const accepted = requestStatus === 'accepted';

  return (
    <article className="social-candidate-card">
      <div className="social-candidate-avatar" aria-hidden="true">
        {candidate.avatarUrl ? <img src={candidate.avatarUrl} alt="" /> : candidate.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="social-candidate-copy">
        <h4>{candidate.name}</h4>
        <p>{[candidate.distance, candidate.district].filter(Boolean).join(' · ') || 'В вашем городе'}</p>
        <div className="social-reasons" aria-label="Почему анкета показана">
          {(candidate.reasons.length ? candidate.reasons : ['Подходит цель знакомства']).slice(0, 2).map((reason) => (
            <span key={reason}>{reason}</span>
          ))}
        </div>
      </div>
      <button
        type="button"
        disabled={busy || !scenario || pending || accepted}
        onClick={() => scenario && onRequest(scenario)}
      >
        {busy ? 'Отправляю…' : pending ? 'Ожидает ответа' : accepted ? 'Запрос принят' : 'Отправить запрос'}
      </button>
      {scenario && <small>Цель: {scenarioLabels[scenario]}</small>}
    </article>
  );
}

