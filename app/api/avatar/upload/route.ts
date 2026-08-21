import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Legacy public upload is retired. Originals now go to a private pet-bound bucket.
export async function POST() {
  return NextResponse.json({
    error: 'AVATAR_API_MOVED',
    next: '/api/v1/pets/{petId}/avatar/assets',
  }, { status: 410 });
}
