const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildSyntheticTopology() {
  return {
    owners: [
      {
        key: 'owner-a',
        pets: [
          { key: 'dog-a1', id: '00000000-0000-4000-8000-0000000000a1' },
          { key: 'dog-a2', id: '00000000-0000-4000-8000-0000000000a2' },
        ],
      },
      {
        key: 'owner-b',
        pets: [{ key: 'dog-b1', id: '00000000-0000-4000-8000-0000000000b1' }],
      },
    ],
  };
}

export function extractTelegramUserId(initData) {
  try {
    const raw = new URLSearchParams(initData).get('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id === undefined || parsed?.id === null ? null : String(parsed.id);
  } catch {
    return null;
  }
}

export function cookieHasRequiredSecurityFlags(cookie) {
  return /(?:^|;\s*)HttpOnly(?:;|$)/i.test(cookie)
    && /(?:^|;\s*)SameSite=Lax(?:;|$)/i.test(cookie)
    && /(?:^|;\s*)Secure(?:;|$)/i.test(cookie);
}

export function assertSecretSafeText(text, secrets) {
  for (const secret of secrets.filter(Boolean)) {
    if (text.includes(secret)) throw new Error('output contains secret material');
  }
}

export function assertSafeFixtureConfig(config) {
  if (!config.enabled) throw new Error('live owner-isolation fixture run is not enabled');
  let url;
  try {
    url = new URL(config.baseUrl);
  } catch {
    throw new Error('PSYO_QA_ISOLATION_BASE_URL must be a valid URL');
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error('owner-isolation writes are restricted to a loopback app URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('fixture URL must use HTTP(S)');
  if (config.targetEnvironment !== 'qa') {
    throw new Error('owner-isolation writes require the explicit qa environment');
  }
  if (config.isolationAck !== 'isolated-fixtures-only') {
    throw new Error('isolated fixture acknowledgement is required');
  }

  const initData = [config.ownerAInitData, config.ownerBInitData];
  if (initData.some((value) => !value)) throw new Error('two Telegram initData fixtures are required');
  const telegramIds = initData.map(extractTelegramUserId);
  if (telegramIds.some((value) => !value)) throw new Error('both initData fixtures must contain a Telegram user');
  if (telegramIds[0] === telegramIds[1]) throw new Error('fixture owners must be distinct');

  const petIds = [config.ownerAPet1Id, config.ownerAPet2Id, config.ownerBPet1Id];
  if (petIds.some((value) => !uuidPattern.test(value))) throw new Error('fixture pet ids must be UUIDs');
  if (new Set(petIds).size !== petIds.length) throw new Error('fixture pets must be distinct');
}

export function fixtureConfigFromEnv(env = process.env) {
  return {
    enabled: env.PSYO_QA_ISOLATION_RUN === '1',
    baseUrl: env.PSYO_QA_ISOLATION_BASE_URL || '',
    targetEnvironment: env.PSYO_QA_ISOLATION_TARGET || '',
    isolationAck: env.PSYO_QA_ISOLATION_ACK || '',
    ownerAInitData: env.PSYO_QA_OWNER_A_INIT_DATA || '',
    ownerBInitData: env.PSYO_QA_OWNER_B_INIT_DATA || '',
    ownerAPet1Id: env.PSYO_QA_OWNER_A_PET_1_ID || '',
    ownerAPet2Id: env.PSYO_QA_OWNER_A_PET_2_ID || '',
    ownerBPet1Id: env.PSYO_QA_OWNER_B_PET_1_ID || '',
  };
}
