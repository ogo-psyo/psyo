import { NextResponse } from 'next/server';
import { getBreedCare, type BreedId } from '@/lib/data';

export const runtime = 'nodejs';

type FallbackReason = 'missing_openai_key' | 'openai_failed' | 'openai_empty';

function buildPollinationsPrompt(prompt: string, dogName: string, styleId: string, breedId: string) {
  const styleMap: Record<string, string> = {
    city: 'warm 3d dog hero, collectible character card, soft city glow',
    neon: 'neon dog park, holographic collar, premium 3d toy render',
    winter: 'cozy winter dog hero, warm jacket, cinematic snow',
    space: 'game hero dog trading card, tiny astronaut explorer, stars',
    sticker: 'cute bold sticker dog avatar, clean outline, expressive face',
  };
  const visualGuide = prompt.match(/Breed visual guide: ([^\n]+)/i)?.[1] || '';
  const breedReference = prompt.match(/Breed reference: ([^\n]+)/i)?.[1] || '';
  const breedDirectoryGuide = breedId ? getBreedCare(breedId as BreedId).avatarHints : '';
  const compactPrompt = [breedDirectoryGuide, visualGuide, breedReference]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 360);
  return [
    `Premium 3D stylized dog avatar for Pso app.`,
    dogName ? `Dog name: ${dogName}.` : '',
    styleMap[styleId] || styleMap.city,
    compactPrompt,
    `One dog only, friendly, expressive face, full body, clean background, no text, no watermark, no humans.`,
  ].filter(Boolean).join(' ');
}

function pollinationsUrl(prompt: string) {
  const params = new URLSearchParams({
    width: '1024',
    height: '1024',
    nologo: 'true',
    private: 'true',
    enhance: 'false',
    seed: String(Math.floor(Math.random() * 1_000_000_000)),
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

function fallbackResponse(prompt: string, dogName: string, styleId: string, breedId: string, reason: FallbackReason, status = 200) {
  const fallbackPrompt = buildPollinationsPrompt(prompt, dogName, styleId, breedId);
  return NextResponse.json({
    imageUrl: pollinationsUrl(fallbackPrompt),
    mode: 'pollinations_fallback',
    provider: 'pollinations',
    reason,
  }, { status });
}

export async function POST(request: Request) {
  const input = await request.formData();
  const photo = input.get('photo');
  const prompt = String(input.get('prompt') || '').trim();
  const dogName = String(input.get('dogName') || '').trim();
  const styleId = String(input.get('styleId') || 'city').trim();
  const breedId = String(input.get('breedId') || '').trim();

  if (!prompt) {
    return NextResponse.json({ error: 'Avatar prompt is required.' }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallbackResponse(prompt, dogName, styleId, breedId, 'missing_openai_key');
  }

  if (!(photo instanceof File)) {
    return fallbackResponse(prompt, dogName, styleId, breedId, 'missing_openai_key');
  }

  const body = new FormData();
  body.set('model', 'gpt-image-1');
  body.set('image', photo, photo.name || 'dog-reference.png');
  body.set('prompt', prompt);
  body.set('size', '1024x1024');

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return fallbackResponse(prompt, dogName, styleId, breedId, 'openai_failed');
  }

  const image = data?.data?.[0];
  const b64 = image?.b64_json;
  const url = image?.url;

  if (b64) {
    return NextResponse.json({ imageUrl: `data:image/png;base64,${b64}`, provider: 'openai' });
  }

  if (url) {
    return NextResponse.json({ imageUrl: url, provider: 'openai' });
  }

  return fallbackResponse(prompt, dogName, styleId, breedId, 'openai_empty');
}
