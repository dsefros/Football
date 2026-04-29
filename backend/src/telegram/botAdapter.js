const { AppError } = require('../domain/errors');
const { tracker_type } = require('../domain/enums');
const { getState, setState, clearState } = require('./conversationState');

const TEAM_FLOW = {
  START: 'team.players_needed',
  WHEN: 'team.when',
  ZONE: 'team.zone',
  CONFIRM: 'team.confirm'
};

const PLAYER_FLOW = {
  START: 'player.players_count',
  WHEN: 'player.when',
  CONFIRM: 'player.confirm'
};

class BotAdapter {
  constructor({ requestsService, responsesService, usersService, telegramCallbacksService, botUsername = 'bot' }) {
    this.requestsService = requestsService;
    this.responsesService = responsesService;
    this.usersService = usersService;
    this.telegramCallbacksService = telegramCallbacksService;
    this.botUsername = botUsername;
  }

  handleUpdate(update) {
    if (update.message?.text?.startsWith('/start')) return this.handleStart(update);
    if (update.callback_query?.data?.startsWith('t_')) return this.handleCallback(update);
    if (update.message?.text) return this.handleText(update);
    return { type: 'noop' };
  }

  handleStart(update) {
    const payload = update.message.text.split(' ')[1];
    const ctx = this.contextFromMessage(update.message);

    if (payload?.startsWith('r_')) {
      let req;
      try {
        req = this.requestsService.getByToken(payload.slice(2));
      } catch (err) {
        return { type: 'safe_error', text: 'Заявка не найдена или недоступна' };
      }
      const cb = this.telegramCallbacksService.createToken({ action: 'respond_to_request', request_id: req.id, actor_user_id: ctx.user.id });
      return { type: 'request_card', text: this.renderRequest(req), buttons: [{ text: 'Откликнуться', callback_data: cb }] };
    }

    clearState(ctx.telegramUserId);
    return {
      type: 'menu',
      text: 'Выберите действие',
      buttons: [
        { text: 'Ищу где поиграть', callback_data: this.telegramCallbacksService.createToken({ action: 'create_player_request', actor_user_id: ctx.user.id }) },
        { text: 'Ищу игроков на сбор', callback_data: this.telegramCallbacksService.createToken({ action: 'create_team_request', actor_user_id: ctx.user.id }) },
        { text: 'Активные заявки', callback_data: this.telegramCallbacksService.createToken({ action: 'list_active', actor_user_id: ctx.user.id }) },
        { text: 'Мои заявки', callback_data: this.telegramCallbacksService.createToken({ action: 'list_my', actor_user_id: ctx.user.id }) }
      ]
    };
  }

  handleText(update) {
    const ctx = this.contextFromMessage(update.message);
    const state = getState(ctx.telegramUserId);
    if (!state) return { type: 'noop' };
    const text = update.message.text.trim();

    if (state.step === TEAM_FLOW.START) {
      const parsed = Number(text);
      if (Number.isNaN(parsed) || parsed <= 0) return { type: 'ask', text: 'Введите корректное число игроков' };
      setState(ctx.telegramUserId, { ...state, step: TEAM_FLOW.WHEN, payload: { ...state.payload, players_needed_count: parsed } });
      return { type: 'ask', text: 'Когда игра? (ISO или текст)' };
    }
    if (state.step === TEAM_FLOW.WHEN) {
      setState(ctx.telegramUserId, { ...state, step: TEAM_FLOW.ZONE, payload: { ...state.payload, event_datetime: this.isoOrNull(text), comment: text } });
      return { type: 'ask', text: 'Район (например NEVSKY)' };
    }
    if (state.step === TEAM_FLOW.ZONE) {
      const payload = { ...state.payload, zone: text.toUpperCase(), districts_json: [text.toUpperCase()] };
      setState(ctx.telegramUserId, { ...state, step: TEAM_FLOW.CONFIRM, payload });
      return { type: 'confirm', text: `Подтвердить публикацию?\nИгроков нужно: ${payload.players_needed_count}\nКогда: ${payload.comment}\nРайон: ${payload.zone}`, buttons: this.buildConfirmButtons(ctx.user.id) };
    }
    if (state.step === PLAYER_FLOW.START) {
      const parsed = Number(text);
      if (Number.isNaN(parsed) || parsed <= 0) return { type: 'ask', text: 'Введите корректное число игроков' };
      setState(ctx.telegramUserId, { ...state, step: PLAYER_FLOW.WHEN, payload: { ...state.payload, players_count: parsed } });
      return { type: 'ask', text: 'Когда удобно играть?' };
    }
    if (state.step === PLAYER_FLOW.WHEN) {
      const payload = { ...state.payload, event_datetime_from: this.isoOrNull(text), comment: text };
      setState(ctx.telegramUserId, { ...state, step: PLAYER_FLOW.CONFIRM, payload });
      return { type: 'confirm', text: `Подтвердить публикацию?\nИгроков: ${payload.players_count}\nКогда: ${payload.comment}`, buttons: this.buildConfirmButtons(ctx.user.id) };
    }

    return { type: 'noop' };
  }

  handleCallback(update) {
    const actorTelegramId = String(update.callback_query.from.id);
    const ctx = this.contextFromUser(update.callback_query.from);
    const token = this.telegramCallbacksService.resolveToken(update.callback_query.data, ctx.user.id);

    if (token.action === 'create_team_request') {
      setState(actorTelegramId, { step: TEAM_FLOW.START, payload: { tracker_type: tracker_type.TEAM_LOOKING_FOR_PLAYERS } });
      return { type: 'ask', text: 'Сколько игроков нужно?' };
    }
    if (token.action === 'create_player_request') {
      setState(actorTelegramId, { step: PLAYER_FLOW.START, payload: { tracker_type: tracker_type.PLAYER_LOOKING_FOR_GAME } });
      return { type: 'ask', text: 'Сколько игроков?' };
    }
    if (token.action === 'cancel') {
      clearState(actorTelegramId);
      return { type: 'cancelled', text: 'Операция отменена' };
    }
    if (token.action === 'confirm_create') {
      const state = getState(actorTelegramId);
      if (!state) throw new AppError('VALIDATION_ERROR', 'No active conversation');
      const created = this.createAndPublish(ctx.user.id, state.payload);
      clearState(actorTelegramId);
      return { type: 'published', text: `Заявка опубликована\nhttps://t.me/${this.botUsername}?start=r_${created.share_token}` };
    }
    if (token.action === 'list_active') {
      const items = this.requestsService.getActive({}).slice(0, 5).map((req) => ({ text: this.renderRequest(req), callback_data: this.telegramCallbacksService.createToken({ action: 'respond_to_request', request_id: req.id, actor_user_id: ctx.user.id }) }));
      return { type: 'list_active', items };
    }
    if (token.action === 'respond_to_request') {
      try {
        this.responsesService.create(token.request_id, ctx.user.id, { players_count: 1, comment: 'Отклик через Telegram' });
      } catch (err) {
        if (err.code === 'DUPLICATE_RESPONSE') return { type: 'response_sent', text: 'Вы уже откликнулись' };
        throw err;
      }
      return { type: 'response_sent', text: 'Отклик отправлен' };
    }
    if (token.action === 'list_my') {
      const items = this.requestsService.getMyRequests(ctx.user.id).map((req) => ({ text: `${this.renderRequest(req)}\nОткликов: ${req.responses_count || 0}`, callback_data: this.telegramCallbacksService.createToken({ action: 'view_responses', request_id: req.id, actor_user_id: ctx.user.id }) }));
      return { type: 'list_my', items };
    }
    if (token.action === 'view_responses') {
      const items = this.responsesService.listByRequest(token.request_id, ctx.user.id).map((r) => ({
        text: `Отклик ${r.id} от ${r.response_author.display_name || 'user'} (${r.status})`,
        accept_cb: this.telegramCallbacksService.createToken({ action: 'accept_response', response_id: r.id, actor_user_id: ctx.user.id }),
        decline_cb: this.telegramCallbacksService.createToken({ action: 'decline_response', response_id: r.id, actor_user_id: ctx.user.id })
      }));
      return { type: 'responses', items };
    }
    if (token.action === 'accept_response') {
      const accepted = this.responsesService.accept(token.response_id, ctx.user.id);
      return { type: 'response_accepted', text: `Отклик принят\nКонтакт: @${accepted.response_author.telegram_username || 'unknown'}` };
    }
    if (token.action === 'decline_response') {
      this.responsesService.decline(token.response_id, ctx.user.id);
      return { type: 'response_declined', text: 'Отклик отклонен' };
    }

    return { type: 'callback', action: token.action, payload: token.payload };
  }

  createAndPublish(authorUserId, payload) {
    const draft = this.requestsService.createDraft({ author_user_id: authorUserId, tracker_type: payload.tracker_type });
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
    const patch = payload.tracker_type === tracker_type.TEAM_LOOKING_FOR_PLAYERS
      ? { game_type: 'CASUAL', players_needed_count: payload.players_needed_count, event_datetime: payload.event_datetime || this.safeFutureIso(), expires_at: expires, location_mode: (payload.districts_json && payload.districts_json.length > 0) ? 'DISTRICTS' : 'ALL', zone: null, districts_json: (payload.districts_json && payload.districts_json.length > 0) ? payload.districts_json : ['ALL'], location_text: (payload.zone || (payload.districts_json && payload.districts_json[0]) || 'ALL'), formats_json: ['FIVE_A_SIDE'], positions_json: ['UNIVERSAL'], level: 'AMATEUR', payment_type: 'FREE', price_amount: 0, comment: payload.comment }
      : { players_count: payload.players_count, event_datetime_from: payload.event_datetime_from || this.safeFutureIso(), event_datetime_to: payload.event_datetime_to || new Date(new Date(payload.event_datetime_from || this.safeFutureIso()).getTime() + 2 * 3600 * 1000).toISOString(), expires_at: expires, location_mode: (payload.districts_json && payload.districts_json.length > 0) ? 'DISTRICTS' : 'ALL', zone: null, districts_json: (payload.districts_json && payload.districts_json.length > 0) ? payload.districts_json : ['ALL'], location_text: (payload.districts_json && payload.districts_json.length > 0) ? payload.districts_json.join(', ') : 'ALL', formats_json: ['FIVE_A_SIDE'], positions_json: ['UNIVERSAL'], level: 'AMATEUR', payment_type: 'FREE', price_amount: 0, comment: payload.comment };

    this.requestsService.updateDraft(draft.id, patch, authorUserId);
    return this.requestsService.publish(draft.id, authorUserId);
  }


  buildConfirmButtons(actorUserId) {
    return [
      { text: 'Подтвердить', callback_data: this.telegramCallbacksService.createToken({ action: 'confirm_create', actor_user_id: String(actorUserId) }) },
      { text: 'Отмена', callback_data: this.telegramCallbacksService.createToken({ action: 'cancel', actor_user_id: String(actorUserId) }) }
    ];
  }

  contextFromMessage(message) { return { telegramUserId: String(message.from.id), user: this.usersService.telegramUpsert({ id: `tg-${message.from.id}`, telegram_user_id: String(message.from.id), telegram_username: message.from.username || null, display_name: message.from.first_name || `tg-${message.from.id}` }) }; }
  contextFromUser(from) { return { telegramUserId: String(from.id), user: this.usersService.telegramUpsert({ id: `tg-${from.id}`, telegram_user_id: String(from.id), telegram_username: from.username || null, display_name: from.first_name || `tg-${from.id}` }) }; }
  isoOrNull(text) { const d = new Date(text); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
  safeFutureIso() { return new Date(Date.now() + 24 * 3600 * 1000).toISOString(); }
  renderRequest(req) {
    const players = req.players_needed_count ? `нужно игроков: ${req.players_needed_count}` : `игроков: ${req.players_count || '-'}`
    const dt = req.event_datetime || req.event_datetime_from || req.event_datetime_to || 'время не указано';
    return `${req.tracker_type} | ${players} | ${dt} | status=${req.status}`;
  }
}
module.exports = { BotAdapter };
