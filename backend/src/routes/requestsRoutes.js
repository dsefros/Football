const { requireActorId } = require('./authHelpers');

function buildRequestsRoutes({ requestsService, responsesService }) {
  return [
    { method: 'POST', path: '/requests', handler: ({ body, auth }) => requestsService.createDraft({ ...body, author_user_id: requireActorId(auth) }) },
    { method: 'PATCH', path: '/requests/:request_id', handler: ({ params, body, auth }) => requestsService.updateDraft(params.request_id, body, requireActorId(auth)) },
    { method: 'POST', path: '/requests/:request_id/publish', handler: ({ params, auth }) => requestsService.publish(params.request_id, requireActorId(auth)) },
    { method: 'GET', path: '/requests/active', handler: ({ query }) => requestsService.getActive(query) },
    { method: 'GET', path: '/requests/:request_id', handler: ({ params }) => requestsService.getById(params.request_id) },
    { method: 'GET', path: '/requests/by-token/:share_token', handler: ({ params }) => requestsService.getByToken(params.share_token) },
    { method: 'POST', path: '/requests/:request_id/close', handler: ({ params, auth }) => requestsService.close(params.request_id, requireActorId(auth)) },
    { method: 'POST', path: '/requests/:request_id/cancel', handler: ({ params, auth }) => requestsService.cancel(params.request_id, requireActorId(auth)) },
    { method: 'POST', path: '/requests/:request_id/responses', handler: ({ params, body, auth }) => responsesService.create(params.request_id, requireActorId(auth), body) },
    { method: 'GET', path: '/requests/:request_id/responses', handler: ({ params, auth }) => responsesService.listByRequest(params.request_id, requireActorId(auth)) }
  ];
}
module.exports = { buildRequestsRoutes };
