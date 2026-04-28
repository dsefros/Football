function buildJobsRoutes({ expireRequestsService }) {
  return [
    { method: 'POST', path: '/jobs/expire-requests', handler: () => expireRequestsService.run() }
  ];
}
module.exports = { buildJobsRoutes };
