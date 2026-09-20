'use client';

import { useState, type ComponentProps } from 'react';
import type { ProfileMemoryWorkspace } from '@/components/profile/ProfileMemoryWorkspace';
import { type DogProfile } from '@/lib/data';
import { inflectPetName } from '@/lib/copy';
import { ExactIcon, ExactPage, ExactRow } from './ExactShell';
import { ExactMemory } from './ExactMemory';
import { ExactDocument } from './ExactDocument';
import { AgeField } from '@/components/system/AgeField';
import { BreedField } from '@/components/system/BreedField';
import { breedInputValue, breedProfilePatch } from '@/lib/breedSearch';
import { ExactProfileFields } from './ExactProfileFields';

export type ExactProfileView = 'profile' | 'editprofile' | 'memory' | 'documents' | 'document' | 'identity';
type Props = Omit<ComponentProps<typeof ProfileMemoryWorkspace>, 'onDeleteDocument'> & {
  onDeleteDocument: (id: string) => Promise<boolean>;
  view: ExactProfileView; onView: (view: ExactProfileView) => void; guest: boolean; headers: () => Record<string, string>;
  documentId: string | null; onDocumentId: (id: string | null) => void; memoryDrafts: Map<string, string>;
  draft: DogProfile | null; onDraft: (draft: DogProfile | null) => void; onLibrary: () => void;
};
export function ExactProfile(props: Props) {
  const selectedDocument = props.documentId, setSelectedDocument = props.onDocumentId;
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const profile = props.profile, draft = props.draft ?? profile;
  const update = (patch: Partial<DogProfile>) => props.onDraft({ ...draft, ...patch });
  const back = () => props.onView('profile');
  if (props.view === 'memory') return <ExactMemory key={profile.backendPetId} petId={profile.backendPetId} guest={props.guest} draftsStore={props.memoryDrafts} headers={props.headers} onBack={back} />;
  if (props.view === 'document') {
    const document = props.documents.find(item => item.id === selectedDocument);
    return document ? <ExactDocument key={document.id} document={document} dogName={profile.dogName} headers={props.headers} onBack={() => props.onView('documents')} onDiscuss={props.onAskAssistant} onDelete={async () => { if (await props.onDeleteDocument(document.id)) props.onView('documents'); }} deleting={props.documentBusyId === document.id} deleteError={props.error} /> : <ExactPage viewKey="missing-document" onBack={() => props.onView('documents')}><h1>Документ недоступен</h1><p className="lead">Вернись к списку, чтобы выбрать другой документ.</p></ExactPage>;
  }
  if (props.view === 'documents') return <ExactPage viewKey="documents" onBack={back}>
    <h1>Документы</h1><p className="lead">Нужное для приёма или поездки — в одном месте.</p>
    <div className="list">{props.documents.map(item => <ExactRow key={item.id} title={item.title} detail={new Date(item.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} icon="file" onClick={() => { setSelectedDocument(item.id); props.onView('document'); }} />)}</div>
    {!props.documents.length && <p className="empty">Здесь появятся сохранённые документы.</p>}
    <button type="button" className="text-button" onClick={event => props.onAddDocument(event.currentTarget)}><ExactIcon name="plus" />Добавить документ</button>
  </ExactPage>;
  if (props.view === 'editprofile') return <ExactPage viewKey="editprofile" onBack={back}>
    <h1>О {inflectPetName(profile.dogName, 'loct')}</h1>
    <form onSubmit={async event => { event.preventDefault(); if (saving) return; setSaving(true); try { const id = await props.onSaveProfile(draft); if (id) { props.onDraft(null); back(); } } finally { setSaving(false); } }}>
      <fieldset disabled={saving}>
        <div className="field"><label htmlFor="exact-profile-dogName">Имя</label><input id="exact-profile-dogName" value={draft.dogName} required maxLength={80} autoComplete="off" onChange={event => update({dogName:event.target.value})} /></div>
        <AgeField id="dog-age" value={draft.age || draft.lifeStage} onChange={value => update({ age: value, lifeStage: value })} disabled={saving} />
        <BreedField id="exact-breed" value={breedInputValue(draft)} onChange={value => update(breedProfilePatch(value))} disabled={saving} />
        <ExactProfileFields draft={draft} onChange={update} />
        <button type="submit" className="primary full">{saving ? 'Сохраняю…' : 'Сохранить'}</button>
        {props.error && <p className="error" role="alert">{props.error}</p>}
      </fieldset>
    </form>
  </ExactPage>;
  if (props.view === 'identity') return <ExactPage viewKey="identity" onBack={back}>
    <h1>Фото собаки</h1>
    {props.imageUrl && <img className="exact-profile-image" src={props.imageUrl} alt={profile.dogName} />}
    <div className="field exact-photo-upload"><label htmlFor="exact-avatar-file">{photoBusy ? 'Сохраняю фото…' : props.imageUrl ? 'Выбрать другое фото' : 'Выбрать фото'}</label><input id="exact-avatar-file" type="file" aria-label="Фотография собаки" accept="image/jpeg,image/png,image/webp" disabled={photoBusy || !props.avatarCapabilities.uploadsEnabled || props.avatarState === 'rendering'} onChange={async event => { setPhotoBusy(true); try { await props.onPhotoChange(event); } finally { setPhotoBusy(false); } }} /></div>
    {!props.avatarCapabilities.uploadsEnabled && <p className="hint">Загрузка фото пока недоступна.</p>}
    {props.avatarDraftUrl && <div className="row-actions"><button type="button" className="primary" disabled={photoBusy} onClick={async () => {setPhotoBusy(true); try {await props.onActivateAvatar();} finally {setPhotoBusy(false);}}}>Использовать</button><button type="button" className="secondary" disabled={photoBusy} onClick={props.onDiscardAvatarDraft}>Отменить</button></div>}
    {props.avatarCapabilities.generationEnabled && <details><summary>Создать образ</summary>
      <div className="field"><label htmlFor="exact-avatar-prompt">Каким должен быть образ</label><textarea id="exact-avatar-prompt" maxLength={280} value={props.avatarOwnerPrompt} onChange={event=>props.onAvatarPromptChange(event.target.value)}/></div>
      <label className="exact-checkbox"><input type="checkbox" checked={props.avatarConsent} onChange={event=>props.onAvatarConsentChange(event.target.checked)}/>Разрешаю передать описание сервису генерации.</label>
      <button type="button" className="primary" disabled={!props.avatarConsent || props.avatarState==='rendering'} onClick={props.onGenerateAvatar}>{props.avatarState==='rendering'?'Создаю черновик…':'Создать образ'}</button>
    </details>}
    {!props.avatarDraftUrl && <button type="button" className={props.imageUrl ? "primary full" : "text-button"} disabled={photoBusy} onClick={back}>{props.imageUrl ? 'Готово' : 'Не сейчас'}</button>}
    {profile.avatarSource !== 'none' && <button type="button" className="text-button" onClick={props.onUseNoAvatar}>Убрать фото</button>}
    {profile.avatarSource !== 'none' && <button type="button" className="text-button" onClick={props.onRollbackAvatar}>Вернуть предыдущий образ</button>}
    <p className="hint">Фото хранится приватно и не публикуется автоматически.</p>
    {props.error && <p className="error" role="alert">{props.error}</p>}
  </ExactPage>;
  return <ExactPage viewKey="profile">
    <div className="profile-top"><button type="button" className="initial" aria-label={props.imageUrl ? "Изменить фото собаки" : "Добавить фото собаки"} onClick={() => props.onView('identity')}>{props.imageUrl ? <img className="exact-profile-initial" src={props.imageUrl} alt="" /> : profile.dogName.charAt(0)}</button><div><h1>{profile.dogName}</h1><p>{[profile.age || profile.lifeStage, props.breedLabel].filter(Boolean).join(' · ')}</p></div></div>
    {!props.imageUrl && <button type="button" className="text-button" onClick={() => props.onView('identity')}>Добавить фото</button>}
    <button type="button" className="text-button" onClick={() => { if (!props.draft) props.onDraft({ ...profile }); props.onView('editprofile'); }}>Изменить сведения</button>
    <div className="list section-gap">
      <ExactRow title="Наблюдения" detail="Заметки о самочувствии и привычках" icon="book" onClick={props.onOpenHealth} />
      <ExactRow title="Документы" detail="Хранятся отдельно от разговора" icon="file" onClick={() => props.onView('documents')} />
      <ExactRow title="Что помнит Псё" detail="Посмотреть, исправить, забыть" icon="memory" onClick={() => props.onView('memory')} />
      <ExactRow title="Прогулки и места" detail="Сохранённое вами" icon="map" onClick={props.onLibrary} />
      <ExactRow title="План ухода" detail="Дела, календарь и история" icon="clock" onClick={props.onOpenPlan} />
      <ExactRow title="Привычки" detail="Повторяющиеся занятия и отметки" icon="book" onClick={props.onOpenHabits} />
      <ExactRow title="Памятка для других" detail="Выбрать сведения и управлять ссылкой" icon="file" onClick={props.onOpenCard} />
      <ExactRow title="Настройки" detail="Мои собаки, аккаунт и приватность" icon="profile" onClick={props.onOpenSettings} />
    </div>
  </ExactPage>;
}
