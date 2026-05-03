function mapButtons(buttons = [], { twoPerRow = false } = {}) {
  if (!Array.isArray(buttons) || buttons.length === 0) return null;
  if (!twoPerRow) return { inline_keyboard: buttons.map((b) => [{ text: b.text, callback_data: b.callback_data }]) };
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    const row = [buttons[i]].filter(Boolean);
    if (buttons[i + 1]) row.push(buttons[i + 1]);
    rows.push(row.map((b) => ({ text: b.text, callback_data: b.callback_data })));
  }
  return { inline_keyboard: rows };
}

function isExpiredCallbackError(err) {
  const status = err?.status || err?.details?.status;
  const description = String(err?.description || err?.details?.body?.description || err?.message || '').toLowerCase();
  return status === 400 && (
    description.includes('query is too old')
    || description.includes('response timeout expired')
    || description.includes('query id is invalid')
  );
}

function compactFromItems(structured) {
  const items = Array.isArray(structured?.items) ? structured.items.slice(0, 5) : [];
  if (items.length === 0) return { text: structured?.text, buttons: structured?.buttons || [] };

  const lines = [structured.text];
  const buttons = [];
  items.forEach((item, idx) => {
    const n = idx + 1;
    lines.push(`${n}. ${item.text || '—'}`);
    if (item.callback_data) buttons.push({ text: `Открыть ${n}`, callback_data: item.callback_data });
    if (item.accept_cb) buttons.push({ text: `Принять ${n}`, callback_data: item.accept_cb });
    if (item.decline_cb) buttons.push({ text: `Отклонить ${n}`, callback_data: item.decline_cb });
  });

  return { text: lines.join('\n'), buttons };
}

class TelegramResponseDelivery {
  constructor({ apiClient, logger = console } = {}) { this.apiClient = apiClient; this.logger = logger; }

  async deliver(update, structured) {
    if (!this.apiClient || !this.apiClient.enabled) return structured;
    const chatId = update?.message?.chat?.id || update?.message?.from?.id || update?.callback_query?.message?.chat?.id || update?.callback_query?.from?.id;
    const messageId = update?.callback_query?.message?.message_id;

    if (update?.callback_query?.id) {
      try {
        await this.apiClient.answerCallbackQuery(update.callback_query.id, {});
      } catch (err) {
        if (isExpiredCallbackError(err)) this.logger.warn?.('Telegram callback query already expired', err?.description || err?.message || err);
        else this.logger.error?.('Telegram answerCallbackQuery failed', err);
      }
    }

    const compact = compactFromItems(structured);
    if (!compact.text) return structured;

    const markup = mapButtons(compact.buttons, { twoPerRow: true });
    const options = markup ? { reply_markup: markup } : {};

    if (update?.callback_query) {
      if (messageId && chatId) {
        try {
          await this.apiClient.editMessageText(chatId, messageId, compact.text, options);
          return structured;
        } catch (err) {
          this.logger.warn?.('Telegram editMessageText failed, falling back to sendMessage', err?.message || err);
        }
      }
      await this.apiClient.sendMessage(chatId, compact.text, options);
      return structured;
    }

    await this.apiClient.sendMessage(chatId, compact.text, options);
    return structured;
  }
}

module.exports = { TelegramResponseDelivery, isExpiredCallbackError };
