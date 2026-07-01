'use client';

import { createAuthClient } from 'better-auth/client';
import { telegramClient } from 'better-auth-telegram/client';

export const authClient = createAuthClient({
  baseURL: typeof window === 'undefined' ? process.env.NEXT_PUBLIC_APP_URL : window.location.origin,
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [telegramClient()],
});
