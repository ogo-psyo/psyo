import {test,expect} from 'vitest';
import {careDraftPayload,newCareDraft,domainOf,editCareDraft} from '@/lib/careDomains';
import {reminderReceipt} from '@/lib/reminder';
import {careCreateSchema,careDetailsSchema} from '@/lib/server/careDetailsSchema';
const old={id:'r',petId:'p',title:'Когти',type:'grooming',status:'active',dueAt:'2026-09-22T09:00:00Z'};
test('legacy type mapping preserves explicit uncategorized and arbitrary titles',()=>{expect(domainOf(old)).toBe('care');expect(domainOf({...old,careDomain:null})).toBeNull();expect(domainOf({...old,type:'custom',title:'Прививка'})).toBeNull();});
test('receipt carries validated metadata through bootstrap and writes',()=>{expect(reminderReceipt({...old,metadata:{careDomain:'food',note:'Рацион',recurrenceBasis:'completed',reminderPreference:'before'}},'p')).toMatchObject({careDomain:'food',note:'Рацион',recurrenceBasis:'completed',reminderPreference:'before'});expect(reminderReceipt({...old,petId:'other'},'p')).toBeNull();});
test('free draft stays free on edits; past fact never repeats or sets future completedAt',()=>{const draft=newCareDraft(null,undefined,'done');draft.title=' Своё дело ';const data=careDraftPayload(draft);expect(data.careDomain).toBeNull();expect(data.title).toBe('Своё дело');expect(data.recurrence).toBe('none');expect(Date.parse(data.completedAt!)).toBeLessThanOrEqual(Date.now());expect(editCareDraft({...old,careDomain:null}).careDomain).toBeNull();});
test('request metadata rejects wrong enums and overlong notes',()=>{expect(careDetailsSchema.safeParse({careDomain:'x'}).success).toBe(false);expect(careDetailsSchema.safeParse({note:'x'.repeat(2001)}).success).toBe(false);expect(careCreateSchema.safeParse({petId:'p',title:'Hello',dueAt:'not-a-date'}).success).toBe(false);});

test("editing preserves approximate timing; past retries have stable timestamps",()=>{const draft=editCareDraft({...old,timeMode:"approximate"});expect(careDraftPayload(draft).timeMode).toBe("approximate");const past=newCareDraft(null,undefined,"done");expect(careDraftPayload(past).completedAt).toBe(careDraftPayload(past).completedAt);});
