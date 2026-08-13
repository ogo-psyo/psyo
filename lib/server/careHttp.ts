import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

export type CareMutationClaim = {
  replayed: boolean;
  response?: unknown;
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function careRequestFingerprint(value: unknown) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function readCareIdempotencyKey(request: Request, body?: unknown) {
  const source = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const key = String(request.headers.get('idempotency-key') ?? source.idempotencyKey ?? '').trim();
  return key.length >= 8 && key.length <= 128 ? key : null;
}

export function careError(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

export async function beginCareMutation(input: {
  supabase: any;
  ownerId: string;
  idempotencyKey: string;
  operation: string;
  fingerprint: string;
}): Promise<CareMutationClaim> {
  const { supabase, ownerId, idempotencyKey, operation, fingerprint } = input;
  const existing = await supabase
    .from('care_mutations')
    .select('operation, request_fingerprint, response')
    .eq('owner_id', ownerId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    if (existing.data.operation !== operation || existing.data.request_fingerprint !== fingerprint) {
      throw new Error('IDEMPOTENCY_KEY_REUSED');
    }
    if (existing.data.response === null) throw new Error('CARE_MUTATION_IN_PROGRESS');
    return { replayed: true, response: existing.data.response };
  }

  const inserted = await supabase.from('care_mutations').insert({
    owner_id: ownerId,
    idempotency_key: idempotencyKey,
    operation,
    request_fingerprint: fingerprint,
  });
  if (inserted.error?.code === '23505') {
    return beginCareMutation(input);
  }
  if (inserted.error) throw inserted.error;
  return { replayed: false };
}

export async function finishCareMutation(input: {
  supabase: any;
  ownerId: string;
  idempotencyKey: string;
  response: unknown;
}) {
  const result = await input.supabase
    .from('care_mutations')
    .update({ response: input.response })
    .eq('owner_id', input.ownerId)
    .eq('idempotency_key', input.idempotencyKey);
  if (result.error) throw result.error;
}

export async function abortCareMutation(input: {
  supabase: any;
  ownerId: string;
  idempotencyKey: string;
}) {
  await input.supabase
    .from('care_mutations')
    .delete()
    .eq('owner_id', input.ownerId)
    .eq('idempotency_key', input.idempotencyKey)
    .is('response', null);
}

export function careMutationError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : '';
  if (message.includes('IDEMPOTENCY_KEY_REUSED')) {
    return careError('IDEMPOTENCY_KEY_REUSED', 'Этот запрос уже использован для другого изменения.', 409);
  }
  if (message.includes('CARE_MUTATION_IN_PROGRESS')) {
    return careError('CARE_MUTATION_IN_PROGRESS', 'Изменение ещё сохраняется. Повторите через несколько секунд.', 409);
  }
  if (message.includes('PET_NOT_FOUND')) {
    return careError('PET_NOT_FOUND', 'Эта собака не найдена или недоступна.', 404);
  }
  if (message.includes('REMINDER_NOT_FOUND')) {
    return careError('REMINDER_NOT_FOUND', 'Это дело не найдено или недоступно.', 404);
  }
  return careError('CARE_SAVE_FAILED', 'Не удалось сохранить изменение. Попробуйте ещё раз.', 500);
}
