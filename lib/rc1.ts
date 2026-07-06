export type FeatureFlagName =
  | 'billing_enabled'
  | 'plus_paywall_enabled'
  | 'founder_price_enabled'
  | 'weekly_summary_enabled'
  | 'caregiver_invites_enabled'
  | 'pdf_export_enabled'
  | 'browser_qa_enabled'
  | 'lost_mode_enabled'
  | 'ai_qa_enabled'
  | 'telegram_notifications_enabled'
  | 'new_invoices_enabled'
  | 'public_sharing_enabled'
  | 'uploads_enabled'
  | 'avatar_generation_enabled';

export type EntitlementSnapshot = {
  planCode: 'free' | 'plus';
  status: 'active' | 'grace' | 'expired';
  validUntil: string | null;
  limits: {
    pets: number | null;
    activeReminders: number | null;
    historyDays: number | null;
    caregivers: number | null;
    pdfExportsPerMonth: number | null;
    documents: number | null;
  };
  features: string[];
};

export type PlanSnapshot = {
  code: 'free' | 'plus';
  name: string;
  priceStars: number;
  periodSeconds: number | null;
  headline: string;
  cta: string;
  included: string[];
  notPaywalled: string[];
};

export const rc1Config = {
  botUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'psyoo_bot',
  supportContact: process.env.SUPPORT_CONTACT || 'TBD',
  priceStars: readNumber(process.env.SUBSCRIPTION_PRICE_STARS, 199),
  subscriptionPeriodSeconds: readNumber(process.env.SUBSCRIPTION_PERIOD_SECONDS, 60 * 60 * 24 * 30),
  flags: {
    billing_enabled: readBoolean(process.env.BILLING_ENABLED, false),
    plus_paywall_enabled: readBoolean(process.env.PLUS_PAYWALL_ENABLED, false),
    founder_price_enabled: readBoolean(process.env.FOUNDER_PRICE_ENABLED, false),
    weekly_summary_enabled: readBoolean(process.env.WEEKLY_SUMMARY_ENABLED, false),
    caregiver_invites_enabled: readBoolean(process.env.CAREGIVER_INVITES_ENABLED, false),
    pdf_export_enabled: readBoolean(process.env.PDF_EXPORT_ENABLED, true),
    browser_qa_enabled: readBoolean(process.env.BROWSER_QA_ENABLED, false),
    lost_mode_enabled: readBoolean(process.env.LOST_MODE_ENABLED, false),
    ai_qa_enabled: readBoolean(process.env.AI_QA_ENABLED, false),
    telegram_notifications_enabled: readBoolean(process.env.TELEGRAM_NOTIFICATIONS_ENABLED, false),
    new_invoices_enabled: readBoolean(process.env.NEW_INVOICES_ENABLED, false),
    public_sharing_enabled: readBoolean(process.env.PUBLIC_SHARING_ENABLED, true),
    uploads_enabled: readBoolean(process.env.UPLOADS_ENABLED, false),
    avatar_generation_enabled: readBoolean(process.env.AVATAR_GENERATION_ENABLED, false),
  } satisfies Record<FeatureFlagName, boolean>,
};

export const freePlanSnapshot: PlanSnapshot = {
  code: 'free',
  name: 'Псё Free',
  priceStars: 0,
  periodSeconds: null,
  headline: 'Базовая забота, памятка и безопасность остаются бесплатными.',
  cta: 'Продолжить бесплатно',
  included: [
    '1 собака',
    '3 активных дела ухода',
    '30 дней истории',
    'базовая публичная памятка',
    '1 PDF/печать в месяц',
  ],
  notPaywalled: [
    'базовый профиль',
    'базовая памятка',
    'lost/safety минимум',
    'отзыв публичной ссылки',
    'удаление данных',
  ],
};

export const plusPlanSnapshot: PlanSnapshot = {
  code: 'plus',
  name: 'Псё Плюс',
  priceStars: rc1Config.priceStars,
  periodSeconds: rc1Config.subscriptionPeriodSeconds,
  headline: 'Для владельца, который ведёт уход регулярно и хочет больше контекста вокруг собаки.',
  cta: 'Оформить через Telegram Stars',
  included: [
    'до 5 собак',
    'безлимитные активные дела ухода',
    'полная история наблюдений и ухода',
    'расширенные public-card/PDF шаблоны',
    'weekly summary',
    'caregiver access',
    'расширенный экспорт',
  ],
  notPaywalled: freePlanSnapshot.notPaywalled,
};

export const freeEntitlementSnapshot: EntitlementSnapshot = {
  planCode: 'free',
  status: 'active',
  validUntil: null,
  limits: {
    pets: 1,
    activeReminders: 3,
    historyDays: 30,
    caregivers: 1,
    pdfExportsPerMonth: 1,
    documents: 3,
  },
  features: ['notes', 'public_card', 'qr', 'first_reminder'],
};

export const plusEntitlementSnapshot: EntitlementSnapshot = {
  planCode: 'plus',
  status: 'active',
  validUntil: null,
  limits: {
    pets: 5,
    activeReminders: null,
    historyDays: null,
    caregivers: 3,
    pdfExportsPerMonth: null,
    documents: null,
  },
  features: ['notes', 'public_card', 'qr', 'reminders', 'full_history', 'weekly_summary', 'caregivers', 'extended_exports', 'premium_cards'],
};

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function readNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
