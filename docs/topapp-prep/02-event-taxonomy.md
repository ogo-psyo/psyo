# Псё Event Taxonomy

Цель: заранее определить аналитику, чтобы реализация top-app сценария не шла вслепую.

## Principles

- Все события snake_case.
- Все события имеют `app_surface`, `session_id`, `guest_profile_id`, `pet_id?`, `timestamp`.
- Не отправлять raw medical notes, exact coordinates, фото, email, phone.
- Для guest mode использовать stable local anonymous id.
- Health/social/location fields отправлять только как категории/flags.

## Global properties

| Property | Type | Notes |
|---|---|---|
| app_surface | enum | `web`, `pwa`, `capacitor_ios`, `capacitor_android` |
| app_version | string | package/version or build id |
| session_id | string | generated per visit |
| guest_profile_id | string | local id before auth |
| user_id | string? | only after auth |
| pet_id | string? | guest or backend pet id |
| source | string? | route/source screen |
| locale | string | default `ru` |
| device_class | enum | mobile/tablet/desktop |

## Avatar / Onboarding

| Event | When | Key props |
|---|---|---|
| onboarding_viewed | first emotional entry visible | variant |
| avatar_start_clicked | primary CTA clicked | variant |
| avatar_photo_selected | photo selected | file_type, size_bucket, source |
| avatar_skip_photo_clicked | user starts without photo | reason? |
| avatar_style_selected | style picked | style_id |
| avatar_generation_started | generation starts | style_id, has_photo |
| avatar_generation_progress_viewed | progress step shown | step_id |
| avatar_generation_failed | provider/fallback failure | failure_class |
| avatar_fallback_used | fallback path used | fallback_type |
| avatar_completed | image/card ready | style_id, duration_bucket, provider |
| hero_card_viewed | reveal screen visible | style_id |
| hero_card_saved | user saves hero | save_target: local/account |
| hero_card_shared | share/download | channel: download/share_sheet/link |
| world_unlocks_viewed | unlock cards shown | unlocked_count |
| first_quest_selected | first quest picked | quest_type |
| first_quest_completed | first quest done | quest_type |

## Care OS

| Event | When | Key props |
|---|---|---|
| profile_fact_added | any profile fact added | fact_type |
| profile_completion_changed | completion count changes | from_count, to_count |
| today_viewed | Today shown | completion_count, active_reminders_count |
| next_action_viewed | next action card shown | action_type, urgency |
| next_action_clicked | CTA clicked | action_type |
| reminder_created | reminder created | reminder_type, due_bucket, source |
| reminder_completed | done | reminder_type, overdue_bool |
| reminder_snoozed | snooze | reminder_type |
| assistant_question_asked | assistant call | intent_class, profile_ready_bool |
| assistant_answer_viewed | answer rendered | intent_class, safety_class |
| assistant_answer_to_task_clicked | answer converted | task_type |

## World / Map

| Event | When | Key props |
|---|---|---|
| world_viewed | world/map opened | mode |
| new_area_mode_started | user checks new area | location_precision: approximate/manual |
| place_card_viewed | place opened | place_type, trust_level |
| place_route_clicked | route clicked | place_type |
| place_call_clicked | call clicked | place_type, emergency_bool |
| zone_created | safe/risk zone saved | zone_type, radius_bucket, source |
| zone_report_created | community/local report | report_type |
| map_filter_used | filter | filter_id |

## Social

| Event | When | Key props |
|---|---|---|
| dog_card_invite_created | invite/share friend card | channel |
| compatibility_viewed | compatibility shown | result_class, data_quality |
| friend_request_started | user starts invite | source |
| checkin_created | privacy-safe checkin | visibility, area_precision |
| social_safety_tip_viewed | pre-meet checklist shown | context |

## Commerce / Partners

| Event | When | Key props |
|---|---|---|
| wishlist_item_created | item saved | category, source |
| buy_again_clicked | repeat purchase intent | category |
| clinic_emergency_mode_opened | emergency mode | area_source |
| partner_card_viewed | partner/place card | partner_type, trust_level, sponsored_bool |
| partner_disclosure_opened | user opens disclosure | partner_type |
| affiliate_click | external click | category, sponsored_bool |
| review_started | review flow | place_type |
| report_place_clicked | report issue | place_type |

## North Star candidates

- `weekly_active_dog`: pet with hero card + >=3 useful actions in 7 days.
- `activated_dog`: hero_card_saved + first_quest_completed.
- `world_started_dog`: activated_dog + first place/zone/friend/wishlist action.

## Implementation stub

Create `lib/analytics.ts`:

```ts
export function track(event: PsoEventName, props?: Record<string, unknown>) {
  // no-op if analytics key absent
}
```

Do not call provider SDK directly from components.
