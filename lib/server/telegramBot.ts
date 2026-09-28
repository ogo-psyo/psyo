type TelegramResult<T> = { ok?: boolean; result?: T; description?: string };

function token() {
  const value = process.env.TELEGRAM_BOT_TOKEN;
  if (!value) throw new Error('TELEGRAM_BOT_TOKEN_REQUIRED');
  return value;
}

async function callTelegram<T>(method: string, body: Record<string,unknown>, fetcher: typeof fetch = fetch) {
  const response = await fetcher(`https://api.telegram.org/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as TelegramResult<T>;
  if (!response.ok || !payload.ok) throw new Error(`TELEGRAM_${method.toUpperCase()}_FAILED_${response.status}`);
  return payload.result as T;
}

export type TelegramInlineKeyboard = Array<Array<Record<string,unknown>>>;

export async function sendTelegramReminder(input: {
  chatId:string; text:string; keyboard:TelegramInlineKeyboard; fetcher?:typeof fetch;
}) {
  return callTelegram<{message_id:number}>('sendMessage', {
    chat_id: input.chatId,
    text: input.text,
    reply_markup: { inline_keyboard: input.keyboard },
  }, input.fetcher);
}

export async function answerTelegramCallback(callbackQueryId:string,text?:string,fetcher:typeof fetch=fetch) {
  return callTelegram('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  }, fetcher);
}

export async function editTelegramReminder(input:{
  chatId:string; messageId:number; text?:string; keyboard?:TelegramInlineKeyboard; fetcher?:typeof fetch;
}) {
  if (input.text) {
    return callTelegram('editMessageText', {
      chat_id: input.chatId, message_id: input.messageId, text: input.text,
      ...(input.keyboard ? { reply_markup:{inline_keyboard:input.keyboard} } : {}),
    }, input.fetcher);
  }
  return callTelegram('editMessageReplyMarkup', {
    chat_id: input.chatId, message_id: input.messageId,
    reply_markup:{inline_keyboard:input.keyboard ?? []},
  }, input.fetcher);
}
