import { betterAuth } from 'better-auth';
import { telegram } from 'better-auth-telegram';
import { Pool } from 'pg';

type GlobalWithBetterAuthPg = typeof globalThis & {
  __psyoBetterAuthPool?: Pool;
};

const databaseUrl = process.env.BETTER_AUTH_DATABASE_URL || process.env.DATABASE_URL;
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const botUsername = process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'psyoo_bot';
const secret = process.env.BETTER_AUTH_SECRET || process.env.PSYO_SESSION_SIGNING_KEY || process.env.PSYO_ID_PEPPER;
const baseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const disabledBuildSecret = 'psyo-better-auth-disabled-build-secret-change-before-enable';

function getPool() {
  if (!databaseUrl) return undefined;
  const globalForPg = globalThis as GlobalWithBetterAuthPg;
  globalForPg.__psyoBetterAuthPool ??= new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
  });
  return globalForPg.__psyoBetterAuthPool;
}

export const isBetterAuthTelegramEnabled = Boolean(databaseUrl && botToken && secret);
const telegramPlugins = isBetterAuthTelegramEnabled && botToken ? [
  telegram({
    botToken,
    botUsername,
    loginWidget: false,
    miniApp: {
      enabled: true,
      validateInitData: true,
      allowAutoSignin: true,
      mapMiniAppDataToUser: (user) => ({
        name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Telegram user',
        image: user.photo_url,
        telegramId: String(user.id),
        telegramUsername: user.username,
        languageCode: user.language_code,
      }),
    },
  }),
] : [];

export const auth = betterAuth({
  appName: 'Псё',
  baseURL,
  secret: secret || disabledBuildSecret,
  database: getPool(),
  plugins: telegramPlugins,
});
