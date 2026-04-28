const crypto = require('crypto');
const { AppError } = require('../domain/errors');
const { validateRequestDraft } = require('../domain/validation');
const { assertRequestTransition } = require('../domain/statusTransitions');
const { request_status, tracker_type } = require('../domain/enums');
const { createPublicSlug, createShareToken, buildShareText, buildShareUrl } = require('./shareLinksService');

class RequestsService {
  constructor({ requestsRepository, usersRepository, statusEventsRepository, botUsername }) {
    this.requestsRepository = requestsRepository;
    this.usersRepository = usersRepository;
    this.statusEventsRepository = statusEventsRepository;
    this.botUsername = botUsername;
  }

  createDraft(payload) {
    if (!this.usersRepository.getById(payload.author_user_id)) throw new AppError('NOT_FOUND', 'Author not found');
    if (!payload.tracker_type) throw new AppError('VALIDATION_ERROR', 'Validation failed', [{ field: 'tracker_type', message: 'required' }]);
    const now = new Date().toISOString();
    const row = {
      id: crypto.randomUUID(),
      public_slug: createPublicSlug(),
      share_token: createShareToken(),
      tracker_type: payload.tracker_type,
      game_type: payload.game_type || null,
      author_user_id: payload.author_user_id,
      status: request_status.DRAFT,
      is_listed: true,
      source: 'BOT',
      players_count: null,
      players_needed_count: null,
      accepted_players_count: 0,
      event_datetime: null,
      event_datetime_from: null,
      event_datetime_to: null,
      expires_at: payload.expires_at || null,
      location_mode: null,
      zone: null,
      districts_json: [],
      location_text: null,
      formats_json: [],
      positions_json: null,
      positions_needed_json: null,
      level: null,
      surface_type: null,
      payment_type: null,
      price_amount: null,
      price_currency: 'RUB',
      payment_comment: null,
      comment: null,
      created_at: now,
      updated_at: now,
      closed_at: null,
      cancelled_at: null,
      expired_at: null
    };
    return this.requestsRepository.create(row);
  }

  updateDraft(id, patch, actorUserId) {
    const req = this.requireRequest(id);
    if (req.author_user_id !== actorUserId) throw new AppError('FORBIDDEN', 'Only author can edit');
    if (req.status !== request_status.DRAFT) throw new AppError('INVALID_STATUS_TRANSITION', 'Only DRAFT can be edited');

    const allowed = new Set([
      'game_type',
      'players_count',
      'players_needed_count',
      'event_datetime',
      'event_datetime_from',
      'event_datetime_to',
      'expires_at',
      'location_mode',
      'zone',
      'districts_json',
      'location_text',
      'formats_json',
      'positions_json',
      'positions_needed_json',
      'level',
      'surface_type',
      'payment_type',
      'price_amount',
      'price_currency',
      'payment_comment',
      'comment'
    ]);

    const safePatch = Object.fromEntries(Object.entries(patch || {}).filter(([k]) => allowed.has(k)));
    return this.requestsRepository.updateDraft(id, safePatch);
  }

  publish(id, actorUserId) {
    const req = this.requireRequest(id);
    if (req.author_user_id !== actorUserId) throw new AppError('FORBIDDEN', 'Only author can publish');
    if (!req.expires_at) throw new AppError('VALIDATION_ERROR', 'Validation failed', [{ field: 'expires_at', message: 'required' }]);
    if (req.expires_at < new Date().toISOString()) throw new AppError('REQUEST_EXPIRED', 'Cannot publish expired request');
    validateRequestDraft({ ...req, status: request_status.DRAFT });
    assertRequestTransition(req.tracker_type, req.status, request_status.PUBLISHED);
    const updated = this.requestsRepository.updateStatus(id, request_status.PUBLISHED);
    this.logEvent(id, req.status, request_status.PUBLISHED, actorUserId, 'publish');
    const share_url = buildShareUrl(this.botUsername, updated.share_token);
    return { ...updated, share_url, share_text: buildShareText(share_url) };
  }

  close(id, actorUserId) {
    const req = this.requireRequest(id);
    if (req.author_user_id !== actorUserId) throw new AppError('FORBIDDEN', 'Only author can close');
    assertRequestTransition(req.tracker_type, req.status, request_status.CLOSED);
    const updated = this.requestsRepository.updateStatus(id, request_status.CLOSED, { closed_at: new Date().toISOString() });
    this.logEvent(id, req.status, request_status.CLOSED, actorUserId, 'close');
    return updated;
  }

  cancel(id, actorUserId) {
    const req = this.requireRequest(id);
    if (req.author_user_id !== actorUserId) throw new AppError('FORBIDDEN', 'Only author can cancel');
    assertRequestTransition(req.tracker_type, req.status, request_status.CANCELLED);
    const updated = this.requestsRepository.updateStatus(id, request_status.CANCELLED, { cancelled_at: new Date().toISOString() });
    this.logEvent(id, req.status, request_status.CANCELLED, actorUserId, 'cancel');
    return updated;
  }

  markExpired(id) {
    const req = this.requireRequest(id);
    assertRequestTransition(req.tracker_type, req.status, request_status.EXPIRED);
    const updated = this.requestsRepository.updateStatus(id, request_status.EXPIRED, { expired_at: new Date().toISOString() });
    this.logEvent(id, req.status, request_status.EXPIRED, null, 'job_expire');
    return updated;
  }

  getActive(filters) { return this.requestsRepository.getActive(filters); }
  getById(id) { return this.requireRequest(id); }
  getByToken(token) { const req = this.requestsRepository.getByToken(token); if (!req) throw new AppError('NOT_FOUND', 'Request not found'); return req; }
  getMyRequests(userId) { return this.requestsRepository.getByAuthor(userId); }

  applyFirstResponseStatusIfNeeded(requestId) {
    const req = this.requireRequest(requestId);
    if (req.status === request_status.PUBLISHED) {
      const updated = this.requestsRepository.updateStatus(requestId, request_status.HAS_RESPONSES);
      this.logEvent(requestId, req.status, request_status.HAS_RESPONSES, null, 'first_response');
      return updated;
    }
    return req;
  }

  recalcTeamRequestStatus(request) {
    if (request.tracker_type !== tracker_type.TEAM_LOOKING_FOR_PLAYERS) return request;
    let target = request.status;
    if (request.accepted_players_count === request.players_needed_count) target = request_status.FILLED;
    else if (request.accepted_players_count > 0) target = request_status.PARTIALLY_FILLED;
    else if (request.status === request_status.PARTIALLY_FILLED || request.status === request_status.FILLED) target = request_status.HAS_RESPONSES;

    if (target !== request.status) {
      assertRequestTransition(request.tracker_type, request.status, target);
      const updated = this.requestsRepository.updateStatus(request.id, target);
      this.logEvent(request.id, request.status, target, null, 'accepted_count_change');
      return updated;
    }
    return request;
  }

  getExpirableActiveRequests() {
    return this.requestsRepository.all().filter((r) => ['PUBLISHED', 'HAS_RESPONSES', 'PARTIALLY_FILLED', 'FILLED'].includes(r.status) && r.expires_at && r.expires_at < new Date().toISOString());
  }

  requireRequest(id) {
    const req = this.requestsRepository.getById(id);
    if (!req) throw new AppError('NOT_FOUND', 'Request not found');
    return req;
  }

  logEvent(request_id, old_status, new_status, actor_user_id, reason) {
    this.statusEventsRepository.addRequestEvent({ id: crypto.randomUUID(), request_id, old_status, new_status, actor_user_id, reason, created_at: new Date().toISOString() });
  }
}
module.exports = { RequestsService };
