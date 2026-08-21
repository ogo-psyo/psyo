import { getAvatarStyle, getBreed, type DogProfile } from '@/lib/data';
import { PawPrint } from '@phosphor-icons/react';

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

  return (
    <div className={`generated-avatar ${size}${fill ? ' fill' : ''} style-${profile.selectedStyle} ${ready ? 'ready' : 'idle'}`} aria-label="Портрет собаки">
      {source && <span className="avatar-aura" />}
      {source ? (
        <img className="avatar-image" src={source} alt={profile.avatarSource === 'uploaded' ? 'Фото собаки' : 'Портрет собаки'} />
      ) : (
        <div className="avatar-placeholder"><PawPrint size={28} weight="duotone" aria-hidden="true" /><b>Добавить образ</b></div>
      )}
      {source && <span className="avatar-chip breed-chip">{breed.title}</span>}
      {source && profile.avatarSource === 'generated' && <span className="avatar-chip style-chip">{style.title}</span>}
    </div>
  );
}
