import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.append('Set-Cookie', 'psyo_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure');
  return response;
}
