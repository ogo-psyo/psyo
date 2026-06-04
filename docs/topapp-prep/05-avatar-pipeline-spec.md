# Avatar Pipeline Spec

## Goal

Avatar is the emotional hook. It must feel magical, but be architected as a reliable job pipeline with storage, moderation, fallback and cost controls.

## UX contract

User flow:

1. Upload photo or skip.
2. Pick style: `cartoon_hero`, `game_card`, `sticker`.
3. Start generation.
4. See narrative progress.
5. Reveal hero card.
6. Save/share/download.

Fallback must preserve emotion:

- bad photo → choose another / manual hero;
- provider timeout → temporary hero card;
- no provider key → premium demo/fallback, clearly not fake production.

## Job state machine

`queued → validating → generating → postprocessing → ready`

Failure states:

- `failed_input`
- `failed_moderation`
- `failed_provider`
- `failed_timeout`
- `fallback_ready`

## Storage

Buckets:

- private reference photos;
- private generated avatars;
- controlled/public card exports.

Asset types:

- `reference_photo`
- `avatar_image`
- `hero_card_png`
- `thumbnail`

## Provider abstraction

Interface:

```ts
interface AvatarProvider {
  generate(input: AvatarGenerateInput): Promise<AvatarGenerateResult>
}
```

Input:
- pet name;
- style id;
- reference photo path optional;
- breed/size/coat optional;
- safety prompt constraints.

Output:
- image bytes/url;
- provider metadata;
- cost estimate;
- duration.

## Cost guardrails

- guest: max 1–2 generations/day/device;
- logged-in: quota by plan later;
- retry max 1;
- fallback if provider exceeds timeout;
- event log for cost monitoring.

## Safety

- no human face focus;
- reject abusive/explicit prompts;
- no breed-health claims from avatar;
- no public sharing without explicit user action.

## First implementation slice

- Create `lib/avatar/jobs.ts` contract.
- Store local job state in frontend for now.
- Add DB tables as migration draft but do not require backend job yet.
- Generate/reveal UX works with current endpoint/fallback.
