import { getAvatarStyle, getBreed, type DogProfile } from '@/lib/data';
import { Dog } from '@phosphor-icons/react';

export function GeneratedAvatar({
  profile,
  size = 'large',
  ready = false,
  imageUrl = '',
  demo = false,
  fill = false,
}: {
  profile: DogProfile;
  size?: 'small' | 'large';
  ready?: boolean;
  imageUrl?: string;
  demo?: boolean;
  fill?: boolean;
}) {
  const breed = getBreed(profile.breedId);
  const style = getAvatarStyle(profile.selectedStyle);
  const source = imageUrl || profile.avatarImageUrl || '';
  const monogram = profile.dogName.trim().slice(0, 1).toLocaleUpperCase('ru-RU') || 'П';

  return (
    <div className={`generated-avatar ${size}${fill ? ' fill' : ''} style-${profile.selectedStyle} ${ready ? 'ready' : 'idle'}`} aria-label="Портрет собаки">
      {source && <span className="avatar-aura" />}
      {source ? (
        <img className="avatar-image" src={source} alt={profile.avatarSource === 'uploaded' ? 'Фото собаки' : 'Портрет собаки'} />
      ) : (
        <div className="avatar-placeholder"><span className="avatar-monogram" aria-hidden="true">{monogram}</span><Dog size={44} weight="regular" aria-hidden="true" /><b>Добавить образ</b></div>
      )}
      {source && <span className="avatar-chip breed-chip">{breed.title}</span>}
      {source && profile.avatarSource === 'generated' && <span className="avatar-chip style-chip">{style.title}</span>}
    </div>
  );
}
