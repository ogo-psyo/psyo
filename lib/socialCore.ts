export type SocialContactBoundaryResult =
  | { ok: true }
  | { ok: false; code: 'TELEGRAM_CONTACT_SERVER_CONTROLLED'; field: 'telegramUsername' };

export type SocialContactRequest = {
  status: string;
  senderOwnerId: string;
  recipientOwnerId: string;
};

export function validateSocialContactBoundary(input: unknown): SocialContactBoundaryResult {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  if ('telegramUsername' in source || 'telegram_username' in source) {
    return { ok: false, code: 'TELEGRAM_CONTACT_SERVER_CONTROLLED', field: 'telegramUsername' };
  }
  return { ok: true };
}

export function canRevealTelegramContact(request: SocialContactRequest, viewerOwnerId: string) {
  return request.status === 'accepted'
    && (viewerOwnerId === request.senderOwnerId || viewerOwnerId === request.recipientOwnerId);
}
