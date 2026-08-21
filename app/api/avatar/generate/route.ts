import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Legacy unscoped endpoint is intentionally retired. Avatar work must be pet-bound,
// owner-checked and use the explicit draft -> activate lifecycle.
export async function POST() {
  return NextResponse.json({
    error: 'AVATAR_API_MOVED',
    next: '/api/v1/pets/{petId}/avatar/jobs',
  }, { status: 410 });
}
