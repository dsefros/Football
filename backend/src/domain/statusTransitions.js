const { AppError } = require('./errors');
const { tracker_type, request_status, response_status } = require('./enums');

const requestTransitions = {
  [tracker_type.PLAYER_LOOKING_FOR_GAME]: {
    DRAFT: ['PUBLISHED', 'CANCELLED'],
    PUBLISHED: ['HAS_RESPONSES', 'CANCELLED', 'EXPIRED'],
    HAS_RESPONSES: ['CLOSED', 'CANCELLED', 'EXPIRED'],
    CLOSED: ['ARCHIVED'], CANCELLED: ['ARCHIVED'], EXPIRED: ['ARCHIVED']
  },
  [tracker_type.TEAM_LOOKING_FOR_PLAYERS]: {
    DRAFT: ['PUBLISHED', 'CANCELLED'],
    PUBLISHED: ['HAS_RESPONSES', 'CANCELLED', 'EXPIRED'],
    HAS_RESPONSES: ['PARTIALLY_FILLED', 'CANCELLED', 'EXPIRED', 'FILLED'],
    PARTIALLY_FILLED: ['FILLED', 'CANCELLED', 'EXPIRED', 'HAS_RESPONSES'],
    FILLED: ['CLOSED', 'CANCELLED', 'PARTIALLY_FILLED', 'HAS_RESPONSES'],
    CLOSED: ['ARCHIVED'], CANCELLED: ['ARCHIVED'], EXPIRED: ['ARCHIVED']
  }
};

const responseTransitions = {
  REQUESTED: ['ACCEPTED', 'DECLINED', 'CANCELLED_BY_USER', 'EXPIRED'],
  ACCEPTED: ['CANCELLED_BY_USER', 'CANCELLED_BY_AUTHOR'],
};

function assertRequestTransition(trackerType, oldStatus, newStatus) {
  const allowed = requestTransitions[trackerType]?.[oldStatus] || [];
  if (!allowed.includes(newStatus)) throw new AppError('INVALID_STATUS_TRANSITION', `Cannot move request from ${oldStatus} to ${newStatus}`);
}

function assertResponseTransition(oldStatus, newStatus) {
  const allowed = responseTransitions[oldStatus] || [];
  if (!allowed.includes(newStatus)) throw new AppError('INVALID_STATUS_TRANSITION', `Cannot move response from ${oldStatus} to ${newStatus}`);
}

module.exports = { assertRequestTransition, assertResponseTransition, request_status, response_status };
