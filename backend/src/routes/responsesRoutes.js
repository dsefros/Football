function buildResponsesRoutes({ responsesService }) {
  return [
    { method: 'POST', path: '/responses/:response_id/accept', handler: ({ params, body }) => responsesService.accept(params.response_id, body.actor_user_id) },
    { method: 'POST', path: '/responses/:response_id/decline', handler: ({ params, body }) => responsesService.decline(params.response_id, body.actor_user_id) },
    { method: 'POST', path: '/responses/:response_id/cancel-by-user', handler: ({ params, body }) => responsesService.cancelByUser(params.response_id, body.actor_user_id) },
    { method: 'POST', path: '/responses/:response_id/cancel-by-author', handler: ({ params, body }) => responsesService.cancelByAuthor(params.response_id, body.actor_user_id) }
  ];
}
module.exports = { buildResponsesRoutes };
