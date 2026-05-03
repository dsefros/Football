const { AppError } = require('../domain/errors');
const { requireActorId } = require('../auth');

function requireSameActor(auth, userId) {
  const actorId = requireActorId(auth);
  if (actorId !== userId) throw new AppError('FORBIDDEN', 'Forbidden');
  return actorId;
}

module.exports = { requireActorId, requireSameActor };
