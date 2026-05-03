function mapButtons(buttons = []) {
  if (!Array.isArray(buttons) || buttons.length === 0) return null;
  return { inline_keyboard: buttons.map((b) => [{ text: b.text, callback_data: b.callback_data }]) };
}

class TelegramResponseDelivery {
  constructor({ apiClient, logger = console } = {}) {
    this.apiClient = apiClient;
    this.logger = logger;
  }

  async deliver(update, structured) {
    if (!this.apiClient || !this.apiClient.enabled) return structured;
    const chatId = update?.message?.chat?.id || update?.message?.from?.id || update?.callback_query?.message?.chat?.id || update?.callback_query?.from?.id;
    const messageId = update?.callback_query?.message?.message_id;

    if (update?.callback_query?.id) {
      await this.apiClient.answerCallbackQuery(update.callback_query.id, {});
    }

    const text = structured?.text;
    if (text) {
      const markup = mapButtons(structured.buttons);
      if (messageId && ['confirm', 'menu'].includes(structured.type)) {
        await this.apiClient.editMessageText(chatId, messageId, text, markup ? { reply_markup: markup } : {});
      } else {
        await this.apiClient.sendMessage(chatId, text, markup ? { reply_markup: markup } : {});
      }
    }

    if (Array.isArray(structured?.items)) {
      for (const item of structured.items) {
        const buttons = [];
        if (item.callback_data) buttons.push({ text: 'Открыть', callback_data: item.callback_data });
        if (item.accept_cb) buttons.push({ text: 'Принять', callback_data: item.accept_cb });
        if (item.decline_cb) buttons.push({ text: 'Отклонить', callback_data: item.decline_cb });
        const markup = mapButtons(buttons);
        await this.apiClient.sendMessage(chatId, item.text || '—', markup ? { reply_markup: markup } : {});
      }
    }

    return structured;
  }
}

module.exports = { TelegramResponseDelivery };
