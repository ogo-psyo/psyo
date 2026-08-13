import { canRevealTelegramContact, validateSocialContactBoundary, type SocialContactRequest } from '@/lib/socialCore';
import type { VerifiedTelegramContact } from '@/lib/server/telegram';

export { validateSocialContactBoundary };

export const MISSING_TELEGRAM_USERNAME_ACTION = 'Добавьте имя пользователя в настройках Telegram, чтобы открыть чат';

export function bindVerifiedTelegramContact(input: unknown, contact: VerifiedTelegramContact) {
  const boundary = validateSocialContactBoundary(input);
  if (!boundary.ok) return boundary;
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return {
    ok: true as const,
    value: {
      ...source,
      telegram_username: contact.username,
    },
  };
}

export function contactForAcceptedRequest(input: {
  request: SocialContactRequest;
  viewerOwnerId: string;
  otherContact: VerifiedTelegramContact;
}) {
  if (!canRevealTelegramContact(input.request, input.viewerOwnerId)) return null;
  if (!input.otherContact.username) return null;
  return `https://t.me/${input.otherContact.username}`;
}
