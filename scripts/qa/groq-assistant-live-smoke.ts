import assert from 'node:assert/strict';
import { ASSISTANT_SYSTEM_PROMPT } from '../../lib/server/assistantAnswerService';
import { generateGroqAssistantAnswer } from '../../lib/server/groqAssistant';

const prompts = [
  'Категория: general. Контекст профиля: имя: Мята; возрастная группа: adult; энергия: medium. Вопрос пользователя: Как сделать вечернюю прогулку спокойнее, если Мята отвлекается на шум?',
  'Категория: care. Контекст профиля: имя: Мята; задачи: обработка от паразитов. Вопрос пользователя: Помоги составить простой план ухода на неделю без медицинских назначений.',
];

async function main() {
  const results = [];
  for (const prompt of prompts) {
    const result = await generateGroqAssistantAnswer({ system: ASSISTANT_SYSTEM_PROMPT, prompt });
    assert.match(result.text, /[а-яё]/i);
    assert.ok(result.text.length >= 40 && result.text.length <= 1800);
    assert.doesNotMatch(result.text, /(?:дайте|дозировка|доза)[^.!?\n]{0,50}\b\d+(?:[.,]\d+)?\s*(?:мг|мл|табл)/i);
    results.push({ chars: result.text.length, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens });
  }

  console.log(JSON.stringify({ ok: true, model: process.env.GROQ_ASSISTANT_MODEL || 'openai/gpt-oss-20b', results }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
