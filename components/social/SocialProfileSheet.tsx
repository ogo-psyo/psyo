'use client';

import { useEffect, useRef, useState } from 'react';
import type { CoarseLocation, SocialCity, SocialProfile, SocialScenario } from '@/lib/socialCore';

const scenarioOptions: Array<{ value: SocialScenario; label: string }> = [
  { value: 'meet', label: 'Знакомство' },
  { value: 'walk', label: 'Прогулка' },
  { value: 'socialize', label: 'Социализация' },
  { value: 'mating', label: 'Случка' },
];

const districtOptions: Record<SocialCity, string[]> = {
  moscow: ['ЦАО', 'САО', 'СВАО', 'ВАО', 'ЮВАО', 'ЮАО', 'ЮЗАО', 'ЗАО', 'СЗАО', 'ЗелАО', 'ТиНАО'],
  saint_petersburg: ['Адмиралтейский', 'Василеостровский', 'Выборгский', 'Калининский', 'Кировский', 'Красногвардейский', 'Московский', 'Невский', 'Петроградский', 'Приморский', 'Фрунзенский', 'Центральный'],
};

const blankProfile: Omit<SocialProfile, 'petId'> = {
  discoverable: false,
  city: 'moscow',
  district: null,
  coarseLocation: null,
  scenarios: [],
};

export function SocialProfileSheet({
  dogName,
  petId,
  profile,
  busy,
  locating,
  onSave,
  onHide,
  onLocate,
}: {
  dogName: string;
  petId?: string;
  profile: SocialProfile | null;
  busy: boolean;
  locating: boolean;
  onSave: (draft: Omit<SocialProfile, 'petId'>) => boolean | void | Promise<boolean | void>;
  onHide: () => void;
  onLocate: (onReady: (location: CoarseLocation) => void) => void;
}) {
  const [draft, setDraft] = useState<Omit<SocialProfile, 'petId'>>(profile ? {
    discoverable: profile.discoverable,
    city: profile.city,
    district: profile.district,
    coarseLocation: profile.coarseLocation,
    scenarios: profile.scenarios,
  } : blankProfile);

  const dirtyRef = useRef(false);
  const hydratedRef = useRef(false);
  const storageKey = `pso.gav.profile-draft.v1:${petId || profile?.petId || 'guest'}`;
  const [result, setResult] = useState('');
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (['moscow', 'saint_petersburg'].includes(saved.city) && Array.isArray(saved.scenarios)) {
          setDraft(saved); dirtyRef.current = true;
        }
      }
    } catch { /* The form remains usable when session storage is unavailable. */ }
    hydratedRef.current = true;
  }, [storageKey]);
  useEffect(() => {
    if (!dirtyRef.current && profile) setDraft({ ...profile });
  }, [profile]);
  useEffect(() => {
    if (!hydratedRef.current || !dirtyRef.current) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(draft)); } catch { /* Keep the live draft. */ }
  }, [draft, storageKey]);
  async function save(discoverable: boolean) {
    setResult('');
    const confirmed = await onSave({ ...draft, discoverable });
    if (confirmed === true) {
      dirtyRef.current = false;
      try { sessionStorage.removeItem(storageKey); } catch { /* No remote effect. */ }
      setResult(discoverable ? 'Анкета опубликована' : 'Анкета сохранена скрытой');
    }
  }

  function toggleScenario(scenario: SocialScenario) {
    setDraft((current) => ({
      ...current,
      scenarios: current.scenarios.includes(scenario)
        ? current.scenarios.filter((item) => item !== scenario)
        : [...current.scenarios, scenario],
    }));
  }

  const canPublish = draft.scenarios.length > 0;

  return (
    <section onChangeCapture={() => { dirtyRef.current = true; setResult(''); }} className="social-profile-sheet" aria-labelledby="social-profile-title">
      <div className="social-section-heading">
        <div>
          <h3 id="social-profile-title">Анкета {dogName}</h3>
          <p>Она появится в поиске только после твоего решения.</p>
        </div>
        <span className={profile?.discoverable ? 'social-state-on' : 'social-state-off'}>
          {profile?.discoverable ? 'видна' : 'скрыта'}
        </span>
      </div>

      <div className="social-form-grid">
        <label>
          Город
          <select
            value={draft.city}
            onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value as SocialCity, district: null, coarseLocation: null }))}
          >
            <option value="moscow">Москва</option>
            <option value="saint_petersburg">Санкт-Петербург</option>
          </select>
        </label>
        <label>
          Округ или район <span>необязательно</span>
          <select
            value={draft.district ?? ''}
            onChange={(event) => setDraft((current) => ({ ...current, district: event.target.value || null }))}
          >
            <option value="">Не указывать</option>
            {districtOptions[draft.city].map((district) => <option key={district} value={district}>{district}</option>)}
          </select>
        </label>
      </div>

      <fieldset className="social-scenarios">
        <legend>Для чего ищете компанию</legend>
        <div>
          {scenarioOptions.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={draft.scenarios.includes(option.value)}
                onChange={() => toggleScenario(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button
        className="social-location-button"
        type="button"
        disabled={locating}
        onClick={() => onLocate((coarseLocation) => { dirtyRef.current = true; setDraft((current) => ({ ...current, coarseLocation })); })}
      >
        {locating ? 'Определяю район…' : draft.coarseLocation ? 'Местоположение учтено' : 'Искать ближе ко мне'}
      </button>
      <p className="social-privacy-copy">Показываем только диапазон расстояния. Координаты и точный адрес остаются скрыты.</p>

      <div className="social-profile-actions">
        <button
          className="primary"
          type="button"
          disabled={busy || !canPublish}
          onClick={() => save(true)}
        >
          {busy ? 'Сохраняю…' : profile?.discoverable ? 'Сохранить опубликованную' : 'Опубликовать анкету'}
        </button>
        <button className="secondary" type="button" disabled={busy} onClick={() => save(false)}>Сохранить скрытой</button>
        {profile?.discoverable && (
          <button className="secondary" type="button" disabled={busy} onClick={onHide}>Скрыть анкету</button>
        )}
      </div>
      {result && <p role="status">{result}</p>}
      {!canPublish && <p className="social-inline-hint">Выбери хотя бы один сценарий.</p>}
    </section>
  );
}
