class TelegramApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'TelegramApiError';
    this.details = details;
  }
}

class TelegramApiClient {
  constructor({ botToken, apiBaseUrl = 'https://api.telegram.org', enabled = true, fetchImpl = global.fetch } = {}) {
    this.botToken = botToken;
    this.apiBaseUrl = apiBaseUrl;
    this.fetchImpl = fetchImpl;
    this.enabled = enabled && Boolean(botToken);
  }

  async request(method, payload = {}) {
    if (!this.enabled) return { ok: true, result: null, disabled: true };
    if (!this.fetchImpl) throw new TelegramApiError('Fetch implementation is not available');

    const url = `${this.apiBaseUrl.replace(/\/$/, '')}/bot${this.botToken}/${method}`;
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let body;
    try {
      body = await response.json();
    } catch (_) {
      throw new TelegramApiError(`Telegram API ${method} returned invalid JSON`, { status: response.status });
    }

    if (!response.ok) {
      throw new TelegramApiError(`Telegram API ${method} failed with HTTP ${response.status}`, { status: response.status, body });
    }
    if (!body || body.ok !== true) {
      throw new TelegramApiError(`Telegram API ${method} returned ok=false`, { status: response.status, body });
    }
    return body;
  }

  sendMessage(chatId, text, options = {}) {
    return this.request('sendMessage', { chat_id: chatId, text, ...options });
  }

  editMessageText(chatId, messageId, text, options = {}) {
    return this.request('editMessageText', { chat_id: chatId, message_id: messageId, text, ...options });
  }

  answerCallbackQuery(callbackQueryId, options = {}) {
    return this.request('answerCallbackQuery', { callback_query_id: callbackQueryId, ...options });
  }
}

module.exports = { TelegramApiClient, TelegramApiError };
