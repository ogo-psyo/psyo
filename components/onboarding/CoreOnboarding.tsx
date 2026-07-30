'use client';

import type { ChangeEvent, ReactNode } from 'react';

export type CoreOnboardingStep = 'intro' | 'pet' | 'care';

export type OnboardingCareChoice = {
  type: string;
  title: string;
  dueInDays: number;
  label: string;
  dueLabel: string;
};

export function CoreOnboarding({
  step,
  dogName,
  hasPhoto,
  careChoice,
  careOptions,
  busy,
  preview,
  onStart,
  onSkip,
  onNameChange,
  onPhotoChange,
  onCareChoice,
  onBack,
  onContinue,
  onFinish,
}: {
  step: CoreOnboardingStep;
  dogName: string;
  hasPhoto: boolean;
  careChoice: OnboardingCareChoice;
  careOptions: OnboardingCareChoice[];
  busy: boolean;
  preview: ReactNode;
  onStart: () => void;
  onSkip: () => void;
  onNameChange: (value: string) => void;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onCareChoice: (choice: OnboardingCareChoice) => void;
  onBack: () => void;
  onContinue: () => void;
  onFinish: () => Promise<void>;
}) {
  if (step === 'intro') {
    return (
      <section className="onboarding-screen core-onboarding intro">
        <div className="hero-copy">
          <h1>Псё помнит уход за собакой.</h1>
          <p>Добавь питомца и первое дело. После выполнения оно останется в истории.</p>
        </div>
        {preview}
        <button className="primary full" type="button" onClick={onStart}>Создать питомца</button>
        <button className="hero-example-link" type="button" onClick={onSkip}>Открыть пример без сохранения</button>
      </section>
    );
  }

  if (step === 'pet') {
    return (
      <section className="onboarding-screen core-onboarding pet">
        <p className="onboarding-progress">шаг 1 из 2</p>
        <h2>Как зовут собаку?</h2>
        <p>Имя нужно для плана. Фото можно добавить сейчас или позже.</p>
        <label htmlFor="dog-name">Имя</label>
        <input
          id="dog-name"
          className="hero-name-input"
          value={dogName}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Например, Мята"
          autoComplete="off"
        />
        <label htmlFor="dog-photo">Фото необязательно</label>
        <input
          id="dog-photo"
          className="core-photo-input"
          type="file"
          accept="image/*"
          onChange={onPhotoChange}
          aria-describedby="dog-photo-help"
        />
        <span id="dog-photo-help">{hasPhoto ? 'Фото выбрано. Его можно заменить позже в Профиле.' : 'Фото необязательно. Его можно добавить позже в Профиле.'}</span>
        <div className="onboarding-step-actions">
          <button type="button" onClick={onBack}>Назад</button>
          <button className="primary" type="button" onClick={onContinue} disabled={!dogName.trim()}>Продолжить</button>
        </div>
      </section>
    );
  }

  return (
    <section className="onboarding-screen core-onboarding care">
      <p className="onboarding-progress">шаг 2 из 2</p>
      <h2>Что важно не забыть?</h2>
      <p>Выбери первое дело для {dogName.trim()}. Дату и детали можно изменить в Плане.</p>
      <div className="onboarding-reminder-picks" aria-label="Первое дело">
        {careOptions.map((option) => (
          <button
            key={option.type}
            type="button"
            className={careChoice.type === option.type ? 'active' : ''}
            onClick={() => onCareChoice(option)}
            aria-pressed={careChoice.type === option.type}
          >
            {option.label}
            <small>{option.dueLabel}</small>
          </button>
        ))}
      </div>
      <div className="onboarding-care-choice" aria-live="polite">
        <b>{careChoice.title}</b>
        <span>{careChoice.dueLabel}</span>
      </div>
      <div className="onboarding-step-actions">
        <button type="button" onClick={onBack}>Назад</button>
        <button className="primary" type="button" onClick={onFinish} disabled={busy}>{busy ? 'Добавляю…' : 'Добавить дело и открыть Сегодня'}</button>
      </div>
    </section>
  );
}
