const { AppError } = require('../domain/errors');
const { tracker_type, location_mode, zoneToDistricts } = require('../domain/enums');
const { getState, setState, clearState } = require('./conversationState');
const renderer = require('./responseRenderer');

const TEAM_STEPS = ['players_needed_count', 'date', 'time', 'zone', 'format', 'level', 'payment'];
const PLAYER_STEPS = ['players_count', 'date', 'time', 'zone', 'format', 'position', 'level'];

const TEAM_OPTIONS = {
  players_needed_count: [['1', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6+', 6]],
  date: [['Сегодня', 'today'], ['Завтра', 'tomorrow'], ['На неделе', 'week'], ['Выходные', 'weekend'], ['Не важно', 'any']],
  time: [['Утро', 'morning'], ['День', 'day'], ['Вечер', 'evening'], ['20:00', '20:00'], ['21:00', '21:00'], ['Не важно', 'any']],
  zone: [['Север', 'NORTH'], ['Юг', 'SOUTH'], ['Центр', 'CENTER'], ['Любой район', 'ALL']],
  format: [['5x5', 'FIVE_A_SIDE'], ['6x6', 'SIX_A_SIDE'], ['7x7', 'SEVEN_A_SIDE'], ['8x8', 'EIGHT_A_SIDE'], ['11x11', 'ELEVEN_A_SIDE'], ['Любой', 'ANY']],
  level: [['Новички', 'BEGINNER'], ['Любители', 'AMATEUR'], ['Средний', 'MIDDLE'], ['Выше среднего', 'ABOVE_MIDDLE'], ['Любой', 'ANY']],
  payment: [['Бесплатно', 'FREE'], ['Делим поле', 'FIELD_SHARE'], ['Фиксированная сумма', 'FIXED_PRICE']]
};

const PLAYER_OPTIONS = {
  players_count: [['1', 1], ['2', 2], ['3', 3], ['4', 4], ['5+', 5]],
  date: TEAM_OPTIONS.date,
  time: TEAM_OPTIONS.time,
  zone: TEAM_OPTIONS.zone,
  format: TEAM_OPTIONS.format,
  position: [['Вратарь', 'GOALKEEPER'], ['Защитник', 'DEFENDER'], ['Полузащитник', 'MIDFIELDER'], ['Нападающий', 'FORWARD'], ['Универсал', 'UNIVERSAL']],
  level: TEAM_OPTIONS.level
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

  handleStart(update) { /* unchanged */
    const payload = update.message.text.split(' ')[1];
    const ctx = this.contextFromMessage(update.message);
    if (payload?.startsWith('r_')) {
      let req;
      try { req = this.requestsService.getByToken(payload.slice(2)); } catch (_) { return renderer.safeError('Заявка не найдена или недоступна'); }
      const cb = this.telegramCallbacksService.createToken({ action: 'respond_to_request', request_id: req.id, actor_user_id: ctx.user.id });
      return renderer.requestCard(req, [{ text: 'Откликнуться', callback_data: cb }]);
    }
    clearState(ctx.telegramUserId);
    return renderer.mainMenu([
      { text: 'Ищу где поиграть', callback_data: this.telegramCallbacksService.createToken({ action: 'create_player_request', actor_user_id: ctx.user.id }) },
      { text: 'Ищу игроков на сбор', callback_data: this.telegramCallbacksService.createToken({ action: 'create_team_request', actor_user_id: ctx.user.id }) },
      { text: 'Активные заявки', callback_data: this.telegramCallbacksService.createToken({ action: 'list_active', actor_user_id: ctx.user.id }) },
      { text: 'Мои заявки', callback_data: this.telegramCallbacksService.createToken({ action: 'list_my', actor_user_id: ctx.user.id }) }
    ]);
  }

  handleText(update) {
    const ctx = this.contextFromMessage(update.message);
    const state = getState(ctx.telegramUserId);
    if (!state) return { type: 'noop' };
    return { type: 'ask', text: 'Пожалуйста, используйте кнопки ниже для выбора.', buttons: this.stepButtons(ctx.user.id, state.flow, state.step) };
  }

  handleCallback(update) {
    const actorTelegramId = String(update.callback_query.from.id);
    const ctx = this.contextFromUser(update.callback_query.from);
    const token = this.telegramCallbacksService.resolveToken(update.callback_query.data, ctx.user.id);

    if (token.action === 'create_team_request') {
      setState(actorTelegramId, { flow: 'team', step: TEAM_STEPS[0], payload: { tracker_type: tracker_type.TEAM_LOOKING_FOR_PLAYERS } });
      return this.renderStep(ctx.user.id, 'team', TEAM_STEPS[0]);
    }
    if (token.action === 'create_player_request') {
      setState(actorTelegramId, { flow: 'player', step: PLAYER_STEPS[0], payload: { tracker_type: tracker_type.PLAYER_LOOKING_FOR_GAME } });
      return this.renderStep(ctx.user.id, 'player', PLAYER_STEPS[0]);
    }
    if (token.action === 'wizard_select') return this.onWizardSelect(actorTelegramId, ctx.user.id, token.payload);
    if (token.action === 'wizard_publish') {
      const state = getState(actorTelegramId);
      if (!state) throw new AppError('VALIDATION_ERROR', 'No active conversation');
      const created = this.createAndPublish(ctx.user.id, state.payload);
      clearState(actorTelegramId);
      return renderer.success('published', `Заявка опубликована\nhttps://t.me/${this.botUsername}?start=r_${created.share_token}`);
    }
    if (token.action === 'wizard_edit') {
      const state = getState(actorTelegramId);
      if (!state) throw new AppError('VALIDATION_ERROR', 'No active conversation');
      const firstStep = state.flow === 'team' ? TEAM_STEPS[0] : PLAYER_STEPS[0];
      setState(actorTelegramId, { ...state, step: firstStep });
      return this.renderStep(ctx.user.id, state.flow, firstStep);
    }
    if (token.action === 'cancel') { clearState(actorTelegramId); return renderer.cancelled(); }
    if (token.action === 'list_active') {
      const items = this.requestsService.getActive({}).slice(0, 5).map((req) => ({ text: renderer.requestCardText(req), callback_data: this.telegramCallbacksService.createToken({ action: 'respond_to_request', request_id: req.id, actor_user_id: ctx.user.id }) }));
      return renderer.activeRequestsList(items);
    }
    if (token.action === 'respond_to_request') {
      try { this.responsesService.create(token.request_id, ctx.user.id, { players_count: 1, comment: 'Отклик через Telegram' }); }
      catch (err) { if (err.code === 'DUPLICATE_RESPONSE') return { type: 'response_sent', text: 'Вы уже откликнулись' }; throw err; }
      return renderer.success('response_sent', 'Отклик отправлен');
    }
    if (token.action === 'list_my') {
      const items = this.requestsService.getMyRequests(ctx.user.id).map((req) => {
        const responsesCount = this.responsesService.listByRequest(req.id, ctx.user.id).length;
        return { text: `${renderer.requestCardText(req)}\nОткликов: ${responsesCount}`, callback_data: this.telegramCallbacksService.createToken({ action: 'view_responses', request_id: req.id, actor_user_id: ctx.user.id }) };
      });
      return renderer.myRequestsList(items);
    }
    if (token.action === 'view_responses') {
      const items = this.responsesService.listByRequest(token.request_id, ctx.user.id).map((r) => ({
        text: `Отклик ${r.id} от ${r.response_author.display_name || 'user'} (${r.status})`,
        accept_cb: this.telegramCallbacksService.createToken({ action: 'accept_response', response_id: r.id, actor_user_id: ctx.user.id }),
        decline_cb: this.telegramCallbacksService.createToken({ action: 'decline_response', response_id: r.id, actor_user_id: ctx.user.id })
      }));
      return renderer.responsesList(items);
    }
    if (token.action === 'accept_response') {
      const accepted = this.responsesService.accept(token.response_id, ctx.user.id);
      return renderer.success('response_accepted', `Отклик принят\nКонтакт: @${accepted.response_author.telegram_username || 'unknown'}`);
    }
    if (token.action === 'decline_response') { this.responsesService.decline(token.response_id, ctx.user.id); return renderer.success('response_declined', 'Отклик отклонен'); }
    return { type: 'callback', action: token.action, payload: token.payload };
  }

  onWizardSelect(chatId, actorUserId, payload) {
    const state = getState(chatId);
    if (!state || state.flow !== payload.flow || state.step !== payload.step) throw new AppError('VALIDATION_ERROR', 'Wizard step mismatch');
    const nextPayload = { ...state.payload, [payload.step]: payload.value };
    const steps = payload.flow === 'team' ? TEAM_STEPS : PLAYER_STEPS;
    const idx = steps.indexOf(payload.step);
    if (idx === steps.length - 1) {
      setState(chatId, { ...state, payload: nextPayload, step: 'confirm' });
      return renderer.confirmDialog('Подтвердить публикацию?', this.confirmButtons(actorUserId));
    }
    const nextStep = steps[idx + 1];
    setState(chatId, { ...state, payload: nextPayload, step: nextStep });
    return this.renderStep(actorUserId, payload.flow, nextStep);
  }

  renderStep(actorUserId, flow, step) {
    const prompts = { players_needed_count: 'Сколько игроков нужно?', players_count: 'Сколько игроков?', date: 'Когда играть?', time: 'Во сколько?', zone: 'Какой район?', format: 'Какой формат?', level: 'Какой уровень?', payment: 'Тип оплаты?', position: 'Какая позиция?' };
    return { type: 'ask', text: prompts[step], buttons: this.stepButtons(actorUserId, flow, step) };
  }

  stepButtons(actorUserId, flow, step) {
    const options = (flow === 'team' ? TEAM_OPTIONS : PLAYER_OPTIONS)[step] || [];
    const buttons = options.map(([text, value]) => ({ text, callback_data: this.telegramCallbacksService.createToken({ action: 'wizard_select', actor_user_id: String(actorUserId), payload: { flow, step, value } }) }));
    buttons.push({ text: 'Отмена', callback_data: this.telegramCallbacksService.createToken({ action: 'cancel', actor_user_id: String(actorUserId) }) });
    return buttons;
  }

  confirmButtons(actorUserId) {
    return [
      { text: 'Опубликовать', callback_data: this.telegramCallbacksService.createToken({ action: 'wizard_publish', actor_user_id: String(actorUserId) }) },
      { text: 'Изменить', callback_data: this.telegramCallbacksService.createToken({ action: 'wizard_edit', actor_user_id: String(actorUserId) }) },
      { text: 'Отмена', callback_data: this.telegramCallbacksService.createToken({ action: 'cancel', actor_user_id: String(actorUserId) }) }
    ];
  }

  createAndPublish(authorUserId, payload) {
    const draft = this.requestsService.createDraft({ author_user_id: authorUserId, tracker_type: payload.tracker_type });
    const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const dateTime = this.resolveDateTime(payload.date, payload.time);
    const loc = payload.zone === 'ALL'
      ? { location_mode: location_mode.ALL, districts_json: ['ALL'], zone: null, location_text: 'ALL' }
      : { location_mode: location_mode.ZONE, zone: payload.zone, districts_json: zoneToDistricts[payload.zone], location_text: payload.zone };

    const patch = payload.tracker_type === tracker_type.TEAM_LOOKING_FOR_PLAYERS
      ? { game_type: 'CASUAL', players_needed_count: payload.players_needed_count, accepted_players_count: 0, event_datetime: dateTime, expires_at: expires, ...loc, formats_json: [payload.format || 'ANY'], positions_json: ['UNIVERSAL'], level: payload.level || 'ANY', payment_type: payload.payment || 'FREE', price_amount: payload.payment === 'FIXED_PRICE' ? 1000 : 0, payment_comment: payload.payment === 'FIELD_SHARE' ? 'Делим поле' : null }
      : { game_type: 'UNKNOWN', players_count: payload.players_count, event_datetime_from: dateTime, event_datetime_to: new Date(new Date(dateTime).getTime() + 2 * 3600 * 1000).toISOString(), expires_at: expires, ...loc, formats_json: [payload.format || 'ANY'], positions_json: [payload.position || 'UNIVERSAL'], level: payload.level || 'ANY', payment_type: 'FREE', price_amount: 0 };

    this.requestsService.updateDraft(draft.id, patch, authorUserId);
    return this.requestsService.publish(draft.id, authorUserId);
  }

  resolveDateTime(datePreset, timePreset) {
    const base = new Date();
    const day = new Date(base);
    if (datePreset === 'tomorrow') day.setDate(day.getDate() + 1);
    if (datePreset === 'week') day.setDate(day.getDate() + 3);
    if (datePreset === 'weekend') { const dow = day.getDay(); const delta = dow === 6 ? 0 : dow === 0 ? 0 : 6 - dow; day.setDate(day.getDate() + delta); }
    if (datePreset === 'any') day.setDate(day.getDate() + 2);
    const hm = { morning: [10, 0], day: [14, 0], evening: [19, 0], '20:00': [20, 0], '21:00': [21, 0], any: [19, 0] }[timePreset || 'any'];
    day.setHours(hm[0], hm[1], 0, 0);
    if (day.getTime() < Date.now()) {
      if (datePreset === 'weekend') {
        const dow = day.getDay();
        const deltaToSaturday = dow === 6 ? 7 : dow === 0 ? 6 : 6 - dow;
        day.setDate(day.getDate() + deltaToSaturday);
      } else {
        day.setDate(day.getDate() + 1);
      }
    }
    return day.toISOString();
  }

  contextFromMessage(message) { return { telegramUserId: String(message.from.id), user: this.usersService.telegramUpsert({ id: `tg-${message.from.id}`, telegram_user_id: String(message.from.id), telegram_username: message.from.username || null, display_name: message.from.first_name || `tg-${message.from.id}` }) }; }
  contextFromUser(from) { return { telegramUserId: String(from.id), user: this.usersService.telegramUpsert({ id: `tg-${from.id}`, telegram_user_id: String(from.id), telegram_username: from.username || null, display_name: from.first_name || `tg-${from.id}` }) }; }
}

module.exports = { BotAdapter };
