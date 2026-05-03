const { requireActorId } = require('./authHelpers');

function buildJobsRoutes({ expireRequestsService }) {
  return [
    { method: 'POST', path: '/jobs/expire-requests', handler: ({ auth }) => { requireActorId(auth); return expireRequestsService.run(); } }
  ];
}
module.exports = { buildJobsRoutes };
