'use client';
import type { ReactNode } from 'react';
import { CaretRight, Sparkle } from '@phosphor-icons/react';

export function JournalMasthead({ dogName, avatar, onOpenProfile, onAskAssistant }: { dogName?: string; avatar?: ReactNode; onOpenProfile?: () => void; onAskAssistant?: () => void }) {
  return <header className="journal-masthead"><span className="journal-wordmark">псё</span>{onOpenProfile ? <button type="button" className="journal-dog-switch" aria-label={`Открыть профиль ${dogName} в Псё`} onClick={onOpenProfile}><span className="journal-switch-avatar">{avatar}</span><span>{dogName}</span><CaretRight aria-hidden="true" /></button> : <button type="button" className="journal-quiet" aria-label="Спросить Псё" onClick={onAskAssistant}><Sparkle aria-hidden="true" />Спросить</button>}</header>;
}
