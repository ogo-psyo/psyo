import { getAvatarStyle, getBreed, type DogProfile } from '@/lib/data';

export function GeneratedAvatar({
  profile,
  size = 'large',
  ready = false,
  imageUrl = '',
  demo = false,
}: {
  profile: DogProfile;
  size?: 'small' | 'large';
  ready?: boolean;
  imageUrl?: string;
  demo?: boolean;
}) {
  const breed = getBreed(profile.breedId);
  const style = getAvatarStyle(profile.selectedStyle);
  const source = imageUrl || profile.avatarImageUrl || (ready || demo ? '/demo-avatar.png' : '');

  return (
    <div className={`generated-avatar ${size} style-${profile.selectedStyle} ${ready ? 'ready' : 'idle'}`} aria-label="Avatar собаки">
      <span className="avatar-aura" />
      {source ? (
        <img className="avatar-image" src={source} alt={profile.avatarSource === 'uploaded' ? 'Фото собаки' : 'Avatar собаки'} />
      ) : (
        <div className="avatar-placeholder"><span>{breed.emoji}</span><b>фото</b></div>
      )}
      <span className="avatar-chip breed-chip">{breed.title}</span>
      <span className="avatar-chip style-chip">{style.title}</span>
    </div>
  );
}
