import {z} from 'zod';
export const careDetailsSchema=z.object({
 careDomain:z.enum(['health','activity','food','care','behavior']).nullable().optional(),
 note:z.string().trim().max(2000).optional(),
 recurrenceBasis:z.enum(['planned','completed']).optional(),
 reminderPreference:z.enum(['off','day','before']).optional(),
});
export const careCreateSchema=careDetailsSchema.extend({
 title:z.string().trim().min(1).max(200),petId:z.string().min(1),dueAt:z.iso.datetime({offset:true}),
 type:z.string().min(1).max(80).optional(),recurrence:z.enum(['none','daily','weekly','monthly','quarterly','yearly']).optional(),
 timeMode:z.enum(['exact','flexible','approximate']).optional(),completedAt:z.iso.datetime({offset:true}).optional(),
});
