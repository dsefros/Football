function buildRequestsRoutes({ requestsService, responsesService }) {
  return [
    { method: 'POST', path: '/requests', handler: ({ body }) => requestsService.createDraft(body) },
    { method: 'PATCH', path: '/requests/:request_id', handler: ({ params, body }) => requestsService.updateDraft(params.request_id, body, body.actor_user_id) },
    { method: 'POST', path: '/requests/:request_id/publish', handler: ({ params, body }) => requestsService.publish(params.request_id, body.actor_user_id) },
    { method: 'GET', path: '/requests/active', handler: ({ query }) => requestsService.getActive(query) },
    { method: 'GET', path: '/requests/:request_id', handler: ({ params }) => requestsService.getById(params.request_id) },
    { method: 'GET', path: '/requests/by-token/:share_token', handler: ({ params }) => requestsService.getByToken(params.share_token) },
    { method: 'POST', path: '/requests/:request_id/close', handler: ({ params, body }) => requestsService.close(params.request_id, body.actor_user_id) },
    { method: 'POST', path: '/requests/:request_id/cancel', handler: ({ params, body }) => requestsService.cancel(params.request_id, body.actor_user_id) },
    { method: 'POST', path: '/requests/:request_id/responses', handler: ({ params, body }) => responsesService.create(params.request_id, body.actor_user_id, body) },
    { method: 'GET', path: '/requests/:request_id/responses', handler: ({ params, query }) => responsesService.listByRequest(params.request_id, query.actor_user_id) }
  ];
}
module.exports = { buildRequestsRoutes };
