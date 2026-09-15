import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ auth:vi.fn(), session:vi.fn(), admin:vi.fn(), rpc:vi.fn() }));
vi.mock('@/lib/server/auth',()=>({getRequestAuth:mock.auth}));
vi.mock('@/lib/server/appSession',()=>({getAppSessionFromRequest:mock.session}));
vi.mock('@/lib/server/supabase',()=>({getSupabaseAdmin:mock.admin}));
import { POST } from '../../../app/api/reminders/[id]/undo-complete/route';
const ctx={params:Promise.resolve({id:'11111111-1111-4111-8111-111111111111'})};
const at='2026-09-15T00:00:00Z';
function request(body:unknown={completedAt:at}, key='undo-completion-12345678') { return new Request('http://localhost/api/reminders/id/undo-complete',{method:'POST',headers:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify(body)}); }
beforeEach(()=>{vi.clearAllMocks();mock.auth.mockResolvedValue({user:null});mock.session.mockReturnValue({ownerId:'owner-a'});mock.admin.mockReturnValue({rpc:mock.rpc});mock.rpc.mockResolvedValue({data:{reminder:{id:'r'},undoneCompletedAt:at},error:null});});
it('rejects missing or conflicting principals without reaching the mutation',async()=>{
 mock.session.mockReturnValue(null);expect((await POST(request(),ctx)).status).toBe(401);
 mock.session.mockReturnValue({ownerId:'owner-a'});mock.auth.mockResolvedValue({user:{id:'owner-b'}});expect((await POST(request(),ctx)).status).toBe(401);expect(mock.rpc).not.toHaveBeenCalled();
});
it('uses only the authenticated owner, never an owner supplied in the body',async()=>{
 const response=await POST(request({ownerId:'other-owner',completedAt:at}),ctx);expect(response.status).toBe(200);
 expect(mock.rpc).toHaveBeenCalledWith('care_undo_reminder_completion_atomic',expect.objectContaining({p_owner_id:'owner-a',p_completed_at:at,p_reminder_id:(await ctx.params).id}));
});
it('requires a valid completion instant and retry key',async()=>{
 for(const [body,key] of [[{completedAt:'yesterday'},'valid-key-12345678'],[{completedAt:at},'']] as const)expect((await POST(request(body,key),ctx)).status).toBe(400);
 expect(mock.rpc).not.toHaveBeenCalled();
});
it('returns conflict instead of claiming later edits were undone',async()=>{
 mock.rpc.mockResolvedValue({data:null,error:{message:'COMPLETION_CHANGED'}});const response=await POST(request(),ctx);expect(response.status).toBe(409);expect((await response.json()).error).toBe('COMPLETION_CHANGED');
});
it('keeps the fingerprint stable on retry and distinguishes different occurrences',async()=>{
 await POST(request(),ctx);await POST(request(),ctx);await POST(request({completedAt:'2026-09-16T00:00:00Z'}),ctx);
 const args=mock.rpc.mock.calls.map(call=>call[1]);expect(args[0]).toEqual(args[1]);expect(args[0].p_request_fingerprint).not.toBe(args[2].p_request_fingerprint);
});
