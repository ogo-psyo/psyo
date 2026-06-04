import { defaultProfile, storageKey, type DogProfile, type UploadedPhoto } from './data';

export type PersistedDogProfile = Omit<DogProfile, 'photos'>;

export function stripPhotos(profile: DogProfile): PersistedDogProfile {
  const { photos: _photos, ...persisted } = profile;
  return persisted;
}

export function hydrateProfile(raw: string | null): DogProfile {
  if (!raw) return defaultProfile;
  const parsed = JSON.parse(raw) as Partial<PersistedDogProfile>;
  return {
    ...defaultProfile,
    ...parsed,
    habits: parsed.habits?.length ? parsed.habits : defaultProfile.habits,
    photos: [],
  };
}

export function saveProfile(profile: DogProfile): { ok: true } | { ok: false; message: string } {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(stripPhotos(profile)));
    return { ok: true };
  } catch {
    return { ok: false, message: 'Не удалось сохранить локально. Фото не пишем в хранилище; попробуй очистить данные сайта.' };
  }
}

export function loadProfile(): DogProfile {
  try {
    return hydrateProfile(window.localStorage.getItem(storageKey));
  } catch {
    window.localStorage.removeItem(storageKey);
    return defaultProfile;
  }
}

export function resetProfileStorage() {
  window.localStorage.removeItem(storageKey);
}

export function createPhotoId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function filesToPhotos(files: File[], maxPhotos: number): Promise<UploadedPhoto[]> {
  return Promise.all(
    files.slice(0, maxPhotos).map(async (file) => ({
      id: createPhotoId(file),
      name: file.name,
      dataUrl: await fileToDataUrl(file),
    })),
  );
}

export async function fileToLocalAvatarDataUrl(file: File, size = 640, quality = 0.84): Promise<string> {
  const source = await fileToDataUrl(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = source;
  });

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return source;

  const side = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const sx = ((image.naturalWidth || image.width) - side) / 2;
  const sy = ((image.naturalHeight || image.height) - side) / 2;
  context.fillStyle = '#f4fbf7';
  context.fillRect(0, 0, size, size);
  context.drawImage(image, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', quality);
}
