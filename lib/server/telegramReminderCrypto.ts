import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function rootSecret() {
  const value = process.env.TELEGRAM_DELIVERY_ENCRYPTION_KEY || '';
  if (value.length < 32) throw new Error('TELEGRAM_DELIVERY_ENCRYPTION_KEY_REQUIRED');
  return value;
}

function key(label: string) {
  return createHash('sha256').update(rootSecret()).update('\0').update(label).digest();
}

export function encryptTelegramChatId(chatId: number | string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key('chat-id-v1'), iv);
  const encrypted = Buffer.concat([cipher.update(String(chatId), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptTelegramChatId(ciphertext: string) {
  const [version, iv, tag, body] = ciphertext.split('.');
  if (version !== 'v1' || !iv || !tag || !body) throw new Error('INVALID_TELEGRAM_DELIVERY_TARGET');
  const decipher = createDecipheriv('aes-256-gcm', key('chat-id-v1'), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
}

function compactUuid(id: string) {
  if (!uuidPattern.test(id)) throw new Error('INVALID_REMINDER_ID');
  return Buffer.from(id.replaceAll('-', ''), 'hex').toString('base64url');
}

function expandUuid(value: string) {
  const hex = Buffer.from(value, 'base64url').toString('hex');
  if (hex.length !== 32) return null;
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export type TelegramReminderAction = 'done' | 'later' | 'day' | 'week';
const actionCodes: Record<TelegramReminderAction,string> = { done:'d', later:'l', day:'1', week:'7' };
const actionsByCode = Object.fromEntries(Object.entries(actionCodes).map(([action,code])=>[code,action])) as Record<string,TelegramReminderAction>;

export function telegramReminderCallback(action: TelegramReminderAction, reminderId: string, occurrenceDueAt: string) {
  const seconds = Math.floor(Date.parse(occurrenceDueAt) / 1000);
  if (!Number.isFinite(seconds)) throw new Error('INVALID_OCCURRENCE');
  const payload = `${actionCodes[action]}.${compactUuid(reminderId)}.${seconds.toString(36)}`;
  const signature = createHmac('sha256', key('callback-v1')).update(payload).digest('base64url').slice(0,12);
  return `care.${payload}.${signature}`;
}

export function parseTelegramReminderCallback(value: string) {
  const parts = value.split('.');
  if (parts.length !== 5 || parts[0] !== 'care') return null;
  const [, actionCode, compactId, seconds36, signature] = parts;
  const payload = `${actionCode}.${compactId}.${seconds36}`;
  const expected = createHmac('sha256', key('callback-v1')).update(payload).digest('base64url').slice(0,12);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  const reminderId = expandUuid(compactId);
  const seconds = Number.parseInt(seconds36,36);
  const action = actionsByCode[actionCode];
  if (!reminderId || !action || !Number.isSafeInteger(seconds)) return null;
  return { action, reminderId, occurrenceDueAt: new Date(seconds * 1000).toISOString() };
}
