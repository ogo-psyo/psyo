import { NextResponse } from 'next/server';
import { transitionSocialRequest, type SocialRequestAction } from '@/lib/socialCore';
import { readIdempotencyKey, socialRequestContext, socialStorageError } from '@/lib/server/socialHttp';
import { areRequestPetsDiscoverable, contactUrlForRequestRow, enforceSocialRateLimit, isOwnerPairBlocked } from '@/lib/server/socialService';

export const runtime = 'nodejs';

const requestActions = new Set<SocialRequestAction>(['accept', 'reject', 'cancel', 'block']);

export async function PATCH(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const context = await socialRequestContext(request);
  if ('response' in context) return context.response;
  const { id } = await routeContext.params;
  const body = await request.json().catch(() => null);
  const action = typeof body?.action === 'string' ? body.action : '';
  try {
    const { data: current, error } = await context.supabase
      .from('social_match_requests').select('*').eq('id', id).maybeSingle();
    if (error) return socialStorageError();
    if (!current || ![current.sender_owner_id, current.recipient_owner_id].includes(context.ownerId)) {
      return NextResponse.json({ error: 'MATCH_REQUEST_NOT_FOUND' }, { status: 404 });
    }
    const otherOwnerId = current.sender_owner_id === context.ownerId
      ? current.recipient_owner_id
      : current.sender_owner_id;
    const pairBlocked = await isOwnerPairBlocked(context.supabase, current.sender_owner_id, current.recipient_owner_id);
    const participantsAvailable = current.source === 'invite'
      ? true
      : await areRequestPetsDiscoverable(context.supabase, current.sender_pet_id, current.recipient_pet_id);

    if (action === 'report') {
      const idempotencyKey = readIdempotencyKey(request, body);
      const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
      if (!idempotencyKey || reason.length < 3) {
        return NextResponse.json({ error: !idempotencyKey ? 'IDEMPOTENCY_KEY_REQUIRED' : 'REPORT_REASON_REQUIRED' }, { status: 400 });
      }
      const reportedOwnerId = otherOwnerId;
      const { data: replay } = await context.supabase.from('social_reports')
        .select('id, status, created_at').eq('reporter_owner_id', context.ownerId)
        .eq('idempotency_key', idempotencyKey).maybeSingle();
      if (replay) return NextResponse.json({ report: replay, queued: true, replayed: true });
      await enforceSocialRateLimit({
        supabase: context.supabase, table: 'social_reports', ownerColumn: 'reporter_owner_id',
        ownerId: context.ownerId, limit: 10, windowMs: 24 * 60 * 60 * 1000,
      });
      const { data: report, error: reportError } = await context.supabase.from('social_reports').insert({
        reporter_owner_id: context.ownerId,
        reported_owner_id: reportedOwnerId,
        request_id: id,
        reason,
        idempotency_key: idempotencyKey,
      }).select('id, status, created_at').single();
      if (reportError) return socialStorageError();
      return NextResponse.json({ report, queued: true }, { status: 201 });
    }

    if (!requestActions.has(action as SocialRequestAction)) {
      return NextResponse.json({ error: 'INVALID_REQUEST_ACTION' }, { status: 400 });
    }
    if (pairBlocked && action !== 'block') {
      return NextResponse.json({ error: 'REQUEST_NOT_AVAILABLE' }, { status: 409 });
    }
    const actor = current.sender_owner_id === context.ownerId ? 'sender' : 'recipient';
    const transition = transitionSocialRequest({
      status: current.status,
      actor,
      action: action as SocialRequestAction,
    });
    if (!transition.ok) return NextResponse.json({ error: transition.code }, { status: transition.code.endsWith('_REQUIRED') ? 403 : 409 });
    if (transition.replayed) {
      return NextResponse.json({
        request: { id, status: transition.status },
        telegramContactUrl: contactUrlForRequestRow(current, context.ownerId, pairBlocked, participantsAvailable),
        replayed: true,
      });
    }

    if (action === 'block') {
      const { error: blockError } = await context.supabase.from('social_blocks').upsert({
        blocker_owner_id: context.ownerId,
        blocked_owner_id: otherOwnerId,
      });
      if (blockError) return socialStorageError();
      const { error: closeError } = await context.supabase.from('social_match_requests')
        .update({ status: 'blocked', responded_at: new Date().toISOString() })
        .or(`and(sender_owner_id.eq.${context.ownerId},recipient_owner_id.eq.${otherOwnerId}),and(sender_owner_id.eq.${otherOwnerId},recipient_owner_id.eq.${context.ownerId})`);
      if (closeError) return socialStorageError();
      return NextResponse.json({ request: { id, status: 'blocked' }, telegramContactUrl: null });
    }
    if (action === 'accept' && !participantsAvailable) {
      return NextResponse.json({ error: 'DISCOVERY_NOT_ENABLED' }, { status: 409 });
    }
    const update: Record<string, unknown> = {
      status: transition.status,
      responded_at: new Date().toISOString(),
    };
    if (action === 'accept') update.recipient_contact_username = context.verifiedTelegramContact.username;
    const { data: updated, error: updateError } = await context.supabase
      .from('social_match_requests')
      .update(update)
      .eq('id', id)
      .eq('status', current.status)
      .select('*').maybeSingle();
    if (updateError) return socialStorageError();
    if (!updated) return NextResponse.json({ error: 'REQUEST_ALREADY_RESOLVED' }, { status: 409 });
    return NextResponse.json({
      request: { id, status: updated.status },
      telegramContactUrl: contactUrlForRequestRow(updated, context.ownerId, false),
      missingTelegramUsernameAction: updated.status === 'accepted' && !context.verifiedTelegramContact.username
        ? 'Добавьте имя пользователя в настройках Telegram, чтобы открыть чат'
        : null,
    });
  } catch (error) {
    return socialStorageError(error);
  }
}
