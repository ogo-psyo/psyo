import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function currentRelease() {
  return process.env.RELEASE_SHA
    || process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.VERCEL_DEPLOYMENT_ID
    || process.env.VERCEL_URL
    || null;
}

export async function GET() {
  return NextResponse.json({ release: currentRelease() }, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}
