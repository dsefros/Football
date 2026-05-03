const { tracker_type } = require('../domain/enums');

function formatDate(value) {
  if (!value) return 'не указано';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'не указано';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function mapStatus(status) {
  const map = {
    DRAFT: 'черновик',
    PUBLISHED: 'опубликована',
    HAS_RESPONSES: 'есть отклики',
    PARTIALLY_FILLED: 'частично набрана',
    FILLED: 'набрана',
    CLOSED: 'закрыта',
    CANCELLED: 'отменена',
    EXPIRED: 'истекла'
  };
  return map[status] || status || 'не указано';
}

function mapPayment(paymentType) {
  if (paymentType === 'FREE') return 'бесплатно';
  return paymentType || 'не указано';
}

function titleForType(type) {
  if (type === tracker_type.TEAM_LOOKING_FOR_PLAYERS) return '⚽ Ищем игроков';
  if (type === tracker_type.PLAYER_LOOKING_FOR_GAME) return '⚽ Игрок ищет игру';
  return '⚽ Заявка';
}

function requestCardText(req) {
  const countLabel = req.tracker_type === tracker_type.TEAM_LOOKING_FOR_PLAYERS ? 'Нужно игроков' : 'Игроков';
  const countValue = req.tracker_type === tracker_type.TEAM_LOOKING_FOR_PLAYERS ? req.players_needed_count : req.players_count;
  const accepted = req.accepted_players_count || 0;
  const total = req.players_needed_count || req.players_count || 0;
  const when = req.event_datetime || req.event_datetime_from || req.event_datetime_to;

  return [
    titleForType(req.tracker_type),
    `Статус: ${mapStatus(req.status)}`,
    `${countLabel}: ${countValue || 'не указано'}`,
    `Принято: ${accepted} / ${total || 'не указано'}`,
    `Когда: ${formatDate(when)}`,
    `Район: ${req.zone || (Array.isArray(req.districts_json) ? req.districts_json.join(', ') : null) || req.location_text || 'не указано'}`,
    `Формат: ${Array.isArray(req.formats_json) ? req.formats_json.join(', ') : (req.game_type || 'не указано')}`,
    `Уровень: ${req.level || 'не указано'}`,
    `Оплата: ${mapPayment(req.payment_type)}`,
    `Комментарий: ${req.comment || '—'}`
  ].join('\n');
}

function mainMenu(buttons) { return { type: 'menu', text: 'Выберите действие', buttons }; }
function requestCard(req, buttons) { return { type: 'request_card', text: requestCardText(req), buttons }; }
function activeRequestsList(items) {
  if (items.length === 0) return { type: 'list_active', text: 'Активных заявок пока нет.', items: [] };
  return { type: 'list_active', text: 'Активные заявки:', items };
}
function myRequestsList(items) {
  if (items.length === 0) return { type: 'list_my', text: 'У вас пока нет заявок.', items: [] };
  return { type: 'list_my', text: 'Ваши заявки:', items };
}
function responsesList(items) {
  if (items.length === 0) return { type: 'responses', text: 'По этой заявке пока нет откликов.', items: [] };
  return { type: 'responses', text: 'Отклики по заявке:', items };
}
function confirmDialog(text, buttons) { return { type: 'confirm', text, buttons }; }
function safeError(text) { return { type: 'safe_error', text }; }
function success(type, text) { return { type, text }; }
function cancelled() { return { type: 'cancelled', text: 'Операция отменена' }; }

module.exports = { mainMenu, requestCard, requestCardText, activeRequestsList, myRequestsList, responsesList, confirmDialog, safeError, success, cancelled };
