import { NextResponse } from 'next/server';
import { rc1Config } from '@/lib/rc1';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';
import { getRequestAuth } from '@/lib/server/auth';
import type { ActionSuggestion, AssistantResponse } from '@/packages/contracts';

export const runtime = 'nodejs';

type AssistantProvider = 'pollinations' | 'rules';

const POLLINATIONS_SYSTEM = [
  'Ты ассистент Pso — приложения про цифровой мир собаки и Care OS.',
  'Отвечай по-русски: 1 короткое вступление + 3–5 bullets, максимум 900 символов.',
  'Без markdown-таблиц, корпоративного тона, агрессивных продаж и выдуманных фактов.',
  'Не ставь диагнозы. Дозировка лекарств и антибиотик/антибиотики — только от ветеринара. При красных флагах здоровья отправляй к ветеринару срочно.',
  'Если данных мало — честно скажи, каких 1–3 фактов не хватает.',
  'Не выдумывай породу, профиль или экипировку; из предметов можно упоминать только поводок, шлейку, ошейник, лакомство, игрушку.',
].join(' ');

const MEDICAL_SAFETY_BLOCKLIST = ['диагноз', 'дозировка', 'антибиотик'];

function hasMedicalSafetyTerm(question: string) {
  const lowerQuestion = question.toLowerCase();
  return MEDICAL_SAFETY_BLOCKLIST.some((term) => lowerQuestion.includes(term));
}

function classifyQuestion(question: string) {
  if (hasMedicalSafetyTerm(question) || /вакцин|привив|рвот|понос|кров|температ|болит|хром|вет|здоров|лекар/i.test(question)) return 'health_triage';
  if (/повод|лай|тян|один|команд|подзыв|тренир|поведен/i.test(question)) return 'training';
  if (/корм|еда|режим|грум|уход|обработ/i.test(question)) return 'care';
  if (/куп|товар|игруш|амуниц|ошейн|шлейк/i.test(question)) return 'shopping';
  return 'general';
}

function buildAnswer(question: string, context: any, reminders: any[]) {
  const pet = context?.pet;
  const passport = context?.passport ?? {};
  const social = context?.social ?? {};
  const name = pet?.name || 'собаки';
  const kind = classifyQuestion(question);
  const facts = [
    pet?.life_stage ? `возраст: ${pet.life_stage}` : null,
    pet?.weight_kg ? `вес: ${pet.weight_kg} кг` : null,
    passport.vaccine_status ? `вакцины: ${passport.vaccine_status}` : null,
    passport.parasite_status ? `обработка: ${passport.parasite_status}` : null,
    social.energy_level ? `энергия: ${social.energy_level}` : null,
    social.social_mode ? `знакомства: ${social.social_mode}` : null,
    Array.isArray(social.triggers) && social.triggers.length ? `триггеры: ${social.triggers.join(', ')}` : null,
  ].filter(Boolean);
  const reminderLine = reminders.length ? `Ближайшие задачи: ${reminders.slice(0, 3).map((item) => item.title).join('; ')}.` : 'Активных задач ухода пока нет — стоит завести хотя бы одну.';
  const base = facts.length ? `Я вижу профиль ${name}: ${facts.join(', ')}. ${reminderLine}` : `По ${name} пока мало данных. ${reminderLine}`;

  if (kind === 'health_triage') return `${base}\n\nБез диагноза: 1) зафиксируй симптом, время, аппетит, воду, стул и активность; 2) проверь, нет ли красных флагов — кровь, повторная рвота/понос, сильная вялость, затруднённое дыхание, боль, судороги, травма; 3) при красных флагах — ветеринар срочно. Если красных флагов нет, запиши наблюдение и поставь напоминание проверить динамику.`;
  if (kind === 'training') return `${base}\n\nПлан на 7 дней: короткие сессии по 5–10 минут, один критерий за раз, награда за спокойное поведение до возбуждения. Если есть триггеры — увеличь дистанцию, не тащи в контакт. При агрессии/панике лучше подключить кинолога.`;
  if (kind === 'care') return `${base}\n\nCare-план: выбери одну регулярную задачу на неделю, поставь напоминание, после выполнения отмечай “готово” или “+1д”. Для вакцин/лекарств сверяй схему с врачом, я не заменяю назначение.`;
  if (kind === 'shopping') return `${base}\n\nПодбор без агрессивной рекламы: сначала размер/вес/энергия/триггеры, потом товар. Для прогулок важнее безопасная посадка шлейки/ошейника, для дома — игрушки под стиль игры и уровень возбуждения.`;
  return `${base}\n\nЯ могу помочь в трёх режимах: care-loop на сегодня, безопасный triage здоровья без диагнозов, или план воспитания. Лучше начни с конкретной ситуации: что произошло, когда, как часто, что уже пробовали.`;
}

function tomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function buildActionSuggestions(question: string, context: any): ActionSuggestion[] {
  const kind = classifyQuestion(question);
  const name = context?.pet?.name || 'собаки';

  if (kind === 'shopping') {
    return [{
      type: 'add_wishlist',
      humanLabel: 'Добавить в список вещей',
      payload: {
        title: 'Подобрать вещь под задачу',
        category: 'other',
        note: `Проверить вариант для ${name} после ответа ассистента.`,
      },
    }];
  }

  if (kind === 'training') {
    return [{
      type: 'create_reminder',
      humanLabel: 'Поставить короткую тренировку',
      payload: {
        title: '10 минут спокойной тренировки',
        dueDate: tomorrowDate(),
        note: 'Короткая сессия без перегруза.',
      },
    }];
  }

  if (kind === 'health_triage') {
    return [{
      type: 'create_reminder',
      humanLabel: 'Проверить самочувствие завтра',
      payload: {
        title: 'Проверить самочувствие и записать динамику',
        dueDate: tomorrowDate(),
        note: 'Если есть красные флаги — не ждать напоминания, обратиться к ветеринару срочно.',
      },
      safetyFlag: 'vet_boundary',
    }];
  }

  if (/маршрут|гуля|прогул|парк|мест|самокат|шум/i.test(question)) {
    return [{
      type: 'add_map_note',
      humanLabel: 'Сохранить заметку на карте',
      payload: {
        title: 'Место для спокойной прогулки',
        note: 'Уточнить район и триггеры после прогулки.',
      },
    }];
  }

  return [{
    type: 'create_reminder',
    humanLabel: 'Запланировать следующий шаг',
    payload: {
      title: 'Вернуться к вопросу по уходу',
      dueDate: tomorrowDate(),
    },
  }];
}

function buildAssistantPrompt(question: string, context: any, reminders: any[], rulesAnswer: string) {
  const pet = context?.pet;
  const passport = context?.passport ?? {};
  const social = context?.social ?? {};
  const facts = [
    pet?.name ? `имя: ${pet.name}` : null,
    pet?.life_stage ? `возрастная группа: ${pet.life_stage}` : null,
    pet?.weight_kg ? `вес: ${pet.weight_kg} кг` : null,
    passport.vaccine_status ? `вакцины: ${passport.vaccine_status}` : null,
    passport.parasite_status ? `обработка: ${passport.parasite_status}` : null,
    social.energy_level ? `энергия: ${social.energy_level}` : null,
    social.social_mode ? `социальность: ${social.social_mode}` : null,
    Array.isArray(social.triggers) && social.triggers.length ? `триггеры: ${social.triggers.slice(0, 5).join(', ')}` : null,
    reminders.length ? `задачи: ${reminders.slice(0, 3).map((item) => item.title).join('; ')}` : null,
  ].filter(Boolean).join('; ');

  return [
    `Категория: ${classifyQuestion(question)}.`,
    facts ? `Контекст профиля: ${facts}.` : 'Контекста профиля почти нет.',
    `Вопрос пользователя: ${question.slice(0, 900)}`,
    `Safety baseline: ${rulesAnswer.split('\n\n').slice(-1)[0].slice(0, 500)}`,
  ].join('\n');
}

async function generatePollinationsAnswer(question: string, context: any, reminders: any[], rulesAnswer: string) {
  const prompt = buildAssistantPrompt(question, context, reminders, rulesAnswer);
  const params = new URLSearchParams({
    model: 'openai-fast',
    temperature: '0',
    private: 'true',
    system: POLLINATIONS_SYSTEM,
  });
  const response = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}?${params.toString()}`, {
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Pollinations failed: ${response.status}`);
  const answer = (await response.text()).trim();
  if (!answer || /^(error|rate limit|too many requests)/i.test(answer)) throw new Error('Pollinations returned empty/error text');
  if (answer.includes('|---') || answer.length > 1800) throw new Error('Pollinations returned an overlong answer');
  return answer;
}

async function generateAssistantAnswer(question: string, context: any, reminders: any[]) {
  const rulesAnswer = buildAnswer(question, context, reminders);

  if (!rc1Config.flags.ai_qa_enabled) {
    return {
      answer: rulesAnswer,
      provider: 'rules' as AssistantProvider,
      mode: 'rules_only_ai_disabled',
    };
  }

  try {
    return {
      answer: await generatePollinationsAnswer(question, context, reminders, rulesAnswer),
      provider: 'pollinations' as AssistantProvider,
      mode: 'pollinations_text_fallback',
      fallbackAnswer: rulesAnswer,
    };
  } catch (error) {
    return {
      answer: rulesAnswer,
      provider: 'rules' as AssistantProvider,
      mode: 'rules_fallback',
      reason: error instanceof Error ? error.message : 'unknown_error',
    };
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const question = String(body?.question || '').trim();

  if (!question) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }

  const auth = await getRequestAuth(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  let context = body?.context && typeof body.context === 'object' ? body.context : null;
  let reminders: any[] = Array.isArray(body?.reminders) ? body.reminders.slice(0, 5) : [];

  if (supabase && body?.petId && !auth.user) {
    return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  if (supabase && auth.user && body?.petId) {
    const [pet, passport, social, reminderResult] = await Promise.all([
      supabase.from('pets').select('*').eq('id', body.petId).eq('owner_id', auth.user!.id).maybeSingle(),
      supabase.from('pet_passports').select('*').eq('pet_id', body.petId).maybeSingle(),
      supabase.from('social_profiles').select('*').eq('pet_id', body.petId).maybeSingle(),
      supabase.from('reminders').select('id,title,type,due_at,status').eq('pet_id', body.petId).neq('status', 'done').order('due_at', { ascending: true }).limit(5),
    ]);
    if (!pet.data) return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });
    context = { pet: pet.data, passport: passport.data, social: social.data };
    reminders = reminderResult.data ?? [];
  }

  const generated = await generateAssistantAnswer(question, context, reminders);
  const answer = generated.answer;
  const actionSuggestions = buildActionSuggestions(question, context);
  let threadId: string | undefined;

  if (supabase && auth.user && body?.petId) {
    const kind = classifyQuestion(question);
    const { data: thread } = await supabase.from('assistant_threads').insert({ pet_id: body.petId, kind, title: question.slice(0, 80) }).select('id').single();
    if (thread?.id) {
      threadId = thread.id;
      await supabase.from('assistant_messages').insert([
        { thread_id: thread.id, role: 'user', content: question, metadata: { source: 'app' } },
        { thread_id: thread.id, role: 'assistant', content: answer, model: generated.provider, metadata: { safety: 'no_diagnosis', kind, mode: generated.mode } },
      ]);
    }
  }

  const responseBody: AssistantResponse & Record<string, unknown> = {
    ...(supabase ? { mode: 'supabase-context' } : demoModeResponse('Connect Supabase + LLM provider to persist threads and generate real answers.')),
    context,
    reminders,
    answer,
    threadId,
    actionSuggestions,
    provider: generated.provider,
    mode: generated.mode,
    ...(generated.provider === 'rules' ? { reason: generated.reason } : {}),
    safety: 'No diagnosis. Red flags and professional escalation required for health concerns.',
  };

  return NextResponse.json(responseBody);
}
