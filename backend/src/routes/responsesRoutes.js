const { requireActorId } = require('./authHelpers');

function buildResponsesRoutes({ responsesService }) {
  return [
    { method: 'POST', path: '/responses/:response_id/accept', handler: ({ params, auth }) => responsesService.accept(params.response_id, requireActorId(auth)) },
    { method: 'POST', path: '/responses/:response_id/decline', handler: ({ params, auth }) => responsesService.decline(params.response_id, requireActorId(auth)) },
    { method: 'POST', path: '/responses/:response_id/cancel-by-user', handler: ({ params, auth }) => responsesService.cancelByUser(params.response_id, requireActorId(auth)) },
    { method: 'POST', path: '/responses/:response_id/cancel-by-author', handler: ({ params, auth }) => responsesService.cancelByAuthor(params.response_id, requireActorId(auth)) }
  ];
}
module.exports = { buildResponsesRoutes };
