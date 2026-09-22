#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync('app/page.tsx','utf8');
const ui=readFileSync('components/care/CareWorkspace.tsx','utf8');
assert.ok(page.includes('<CareWorkspace'), 'integrated calendar must be reachable');
for(const token of ['data-care-calendar','<DayPicker','onSelect={d=>d&&calendar(localDay(d),d)}','Предыдущий месяц','Следующий месяц',"view==='calendar'?selected:undefined",'inDate(eventDay(r))',"filter==='free'?domainOf(r)===null",'historyIssues','onRetryHistory','В календарь телефона'])assert.ok(ui.includes(token), `calendar behavior missing: ${token}`);
assert.ok(ui.includes('const careItems=p.loading||p.loadError?[]:p.items'), 'calendar uses supplied authoritative records');
assert.ok(ui.includes('Запланировать') && ui.includes('Уже сделали'), 'both planning and historical facts reachable');
assert.ok(ui.includes('p.loading||p.loadError'), 'load failures must not appear as empty calendars');
assert.ok(ui.includes('useCalendarObservations') && ui.includes('data-observation-id'), 'observation records share the care calendar');
assert.ok(ui.includes('p.observationUndo?.(journal.retry)'), 'restore remains reachable in the calendar');
console.log('care calendar UI contract ok');
