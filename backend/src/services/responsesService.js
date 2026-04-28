const crypto = require('crypto');
const { AppError } = require('../domain/errors');
const { validateResponseCreate } = require('../domain/validation');
const { assertResponseTransition } = require('../domain/statusTransitions');
const { request_status, response_status, tracker_type } = require('../domain/enums');

class ResponsesService {
  constructor({ responsesRepository, requestsRepository, usersRepository, statusEventsRepository, requestsService }) {
    this.responsesRepository = responsesRepository;
    this.requestsRepository = requestsRepository;
    this.usersRepository = usersRepository;
    this.statusEventsRepository = statusEventsRepository;
    this.requestsService = requestsService;
  }

  create(requestId, actorUserId, payload) {
    const req = this.requestsService.requireRequest(requestId);
    if (!this.usersRepository.getById(actorUserId)) throw new AppError('NOT_FOUND', 'User not found');
    if (req.author_user_id === actorUserId) throw new AppError('CANNOT_RESPOND_TO_OWN_REQUEST', 'Cannot respond to own request');
    if ([request_status.CLOSED, request_status.CANCELLED, request_status.EXPIRED, request_status.ARCHIVED].includes(req.status)) throw new AppError('FORBIDDEN', 'Request not active');
    const existing = this.responsesRepository.getByRequestAndUser(requestId, actorUserId);
    if (existing && [response_status.REQUESTED, response_status.ACCEPTED].includes(existing.status)) throw new AppError('DUPLICATE_RESPONSE', 'Duplicate active response');

    const availableSlots = req.players_needed_count ? req.players_needed_count - req.accepted_players_count : 99;
    validateResponseCreate(req, payload, availableSlots);
    const now = new Date().toISOString();

    const row = {
      id: crypto.randomUUID(),
      request_id: requestId,
      user_id: actorUserId,
      status: response_status.REQUESTED,
      players_count: payload.players_count || 1,
      positions_json: payload.positions_json || null,
      offered_event_datetime: payload.offered_event_datetime || null,
      offered_location_text: payload.offered_location_text || null,
      offered_location_mode: payload.offered_location_mode || null,
      offered_zone: payload.offered_zone || null,
      offered_districts_json: payload.offered_districts_json || null,
      offered_format: payload.offered_format || null,
      offered_payment_type: payload.offered_payment_type || null,
      offered_price_amount: payload.offered_price_amount || null,
      offered_payment_comment: payload.offered_payment_comment || null,
      question_text: payload.question_text || null,
      comment: payload.comment || null,
      created_at: now,
      updated_at: now,
      accepted_at: null,
      declined_at: null,
      cancelled_at: null,
      expired_at: null
    };

    const created = this.responsesRepository.create(row);
    this.logEvent(created.id, null, response_status.REQUESTED, actorUserId, 'create');
    this.requestsService.applyFirstResponseStatusIfNeeded(requestId);
    return created;
  }

  listByRequest(requestId, actorUserId) {
    const req = this.requestsService.requireRequest(requestId);
    if (req.author_user_id !== actorUserId) throw new AppError('FORBIDDEN', 'Only request author can view');
    return this.responsesRepository.listByRequest(requestId).map((r) => this.withContacts(r, req));
  }

  accept(responseId, actorUserId) {
    const response = this.requireResponse(responseId);
    const req = this.requestsService.requireRequest(response.request_id);
    if (req.author_user_id !== actorUserId) throw new AppError('FORBIDDEN', 'Only request author can accept');
    assertResponseTransition(response.status, response_status.ACCEPTED);

    if (req.tracker_type === tracker_type.TEAM_LOOKING_FOR_PLAYERS) {
      const availableSlots = req.players_needed_count - req.accepted_players_count;
      if (response.players_count > availableSlots) {
        throw new AppError('NO_AVAILABLE_SLOTS', 'No available slots', [{ field: 'players_count', message: `available_slots=${availableSlots}` }]);
      }
    }

    const updated = this.responsesRepository.updateStatus(responseId, response_status.ACCEPTED, { accepted_at: new Date().toISOString() });
    this.logEvent(responseId, response.status, response_status.ACCEPTED, actorUserId, 'accept');

    if (req.tracker_type === tracker_type.TEAM_LOOKING_FOR_PLAYERS) {
      const count = req.accepted_players_count + updated.players_count;
      const req2 = this.requestsRepository.updateAcceptedCount(req.id, count, req.status);
      this.requestsService.recalcTeamRequestStatus(req2);
    } else if (req.status !== request_status.CLOSED) {
      this.requestsRepository.updateStatus(req.id, request_status.CLOSED, { closed_at: new Date().toISOString() });
      this.requestsService.logEvent(req.id, req.status, request_status.CLOSED, actorUserId, 'accept_closes_request');
    }

    return this.withContacts(updated, req);
  }

  decline(responseId, actorUserId) {
    return this.authorAction(responseId, actorUserId, response_status.DECLINED, 'declined_at', 'decline');
  }

  cancelByUser(responseId, actorUserId) {
    const response = this.requireResponse(responseId);
    if (response.user_id !== actorUserId) throw new AppError('FORBIDDEN', 'Only response author can cancel');
    const target = response_status.CANCELLED_BY_USER;
    assertResponseTransition(response.status, target);
    const prev = { ...response };
    const updated = this.responsesRepository.updateStatus(responseId, target, { cancelled_at: new Date().toISOString() });
    this.logEvent(responseId, prev.status, target, actorUserId, 'cancel_by_user');
    this.adjustAcceptedCountIfNeeded(prev, target);
    return updated;
  }

  cancelByAuthor(responseId, actorUserId) {
    return this.authorAction(responseId, actorUserId, response_status.CANCELLED_BY_AUTHOR, 'cancelled_at', 'cancel_by_author');
  }

  expireRequestedByRequest(requestId) {
    const affected = [];
    for (const response of this.responsesRepository.listByRequest(requestId)) {
      if (response.status !== response_status.REQUESTED) continue;
      const updated = this.responsesRepository.updateStatus(response.id, response_status.EXPIRED, { expired_at: new Date().toISOString() });
      this.logEvent(response.id, response.status, response_status.EXPIRED, null, 'request_expired');
      affected.push(updated);
    }
    return affected;
  }

  authorAction(responseId, actorUserId, targetStatus, stampField, reason) {
    const response = this.requireResponse(responseId);
    const req = this.requestsService.requireRequest(response.request_id);
    if (req.author_user_id !== actorUserId) throw new AppError('FORBIDDEN', 'Only request author allowed');
    assertResponseTransition(response.status, targetStatus);
    const prev = { ...response };
    const updated = this.responsesRepository.updateStatus(responseId, targetStatus, { [stampField]: new Date().toISOString() });
    this.logEvent(responseId, prev.status, targetStatus, actorUserId, reason);
    this.adjustAcceptedCountIfNeeded(prev, targetStatus);
    return updated;
  }

  adjustAcceptedCountIfNeeded(previousResponse, targetStatus) {
    if (previousResponse.status !== response_status.ACCEPTED) return;
    if (![response_status.CANCELLED_BY_USER, response_status.CANCELLED_BY_AUTHOR].includes(targetStatus)) return;
    const req = this.requestsService.requireRequest(previousResponse.request_id);
    const count = req.accepted_players_count - previousResponse.players_count;
    if (count < 0) throw new AppError('VALIDATION_ERROR', 'accepted_players_count below zero');
    const req2 = this.requestsRepository.updateAcceptedCount(req.id, count, req.status);
    this.requestsService.recalcTeamRequestStatus(req2);
  }

  withContacts(response, request) {
    const requestAuthor = this.usersRepository.getById(request.author_user_id);
    const responseAuthor = this.usersRepository.getById(response.user_id);
    if (response.status !== response_status.ACCEPTED) {
      return {
        ...response,
        request_author: { display_name: requestAuthor?.display_name || null, telegram_username: null },
        response_author: { display_name: responseAuthor?.display_name || null, telegram_username: null }
      };
    }
    return {
      ...response,
      request_author: {
        display_name: requestAuthor?.display_name || null,
        telegram_username: requestAuthor?.telegram_username || null
      },
      response_author: {
        display_name: responseAuthor?.display_name || null,
        telegram_username: responseAuthor?.telegram_username || null
      }
    };
  }

  requireResponse(id) {
    const row = this.responsesRepository.getById(id);
    if (!row) throw new AppError('NOT_FOUND', 'Response not found');
    return row;
  }

  logEvent(response_id, old_status, new_status, actor_user_id, reason) {
    this.statusEventsRepository.addResponseEvent({ id: crypto.randomUUID(), response_id, old_status, new_status, actor_user_id, reason, created_at: new Date().toISOString() });
  }
}
module.exports = { ResponsesService };
