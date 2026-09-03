#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('app/page.tsx', 'utf8');
const styles = readFileSync('app/globals.css', 'utf8');

for (const token of [
  'data-care-calendar',
  'calendarDays.map',
  'selectedDateReminders.map',
  'setNewReminderDueDate(selectedCalendarDate)',
  'Предыдущий месяц',
  'Следующий месяц',
  'Дела на выбранную дату',
]) {
  assert.match(page, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `care calendar UI missing: ${token}`);
}

assert.doesNotMatch(page, /visibleCareReminders\.map/, 'active care view must not render the bulk reminder list');
assert.match(page, />Календарь<\/button>/, 'active care tab must be named Calendar');

for (const token of ['.care-calendar-panel', '.care-calendar-grid', '.calendar-day.has-care', '.selected-day-panel']) {
  assert.match(styles, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `care calendar styles missing: ${token}`);
}

console.log('care calendar UI contract ok');
