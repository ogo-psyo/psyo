import { auth } from '@/lib/server/betterAuth';
import { toNextJsHandler } from 'better-auth/next-js';

export const runtime = 'nodejs';

export const { GET, POST } = toNextJsHandler(auth);
