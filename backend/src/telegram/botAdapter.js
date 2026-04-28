const { mainMenu } = require('./renderers');

class BotAdapter {
  constructor({ requestsService, telegramCallbacksService }) {
    this.requestsService = requestsService;
    this.telegramCallbacksService = telegramCallbacksService;
  }

  handleUpdate(update) {
    if (update.message?.text?.startsWith('/start')) {
      const payload = update.message.text.split(' ')[1];
      if (payload?.startsWith('r_')) {
        const shareToken = payload.slice(2);
        const req = this.requestsService.getByToken(shareToken);
        return { type: 'request_card', request_id: req.id };
      }
      return { type: 'menu', ...mainMenu() };
    }

    if (update.callback_query?.data?.startsWith('t_')) {
      const actorTelegramId = update.callback_query?.from?.id ? String(update.callback_query.from.id) : null;
      const token = this.telegramCallbacksService.resolveToken(update.callback_query.data, actorTelegramId);
      return { type: 'callback', action: token.action, payload: token.payload };
    }

    return { type: 'noop' };
  }
}
module.exports = { BotAdapter };
