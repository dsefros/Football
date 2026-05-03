const { requireSameActor } = require('./authHelpers');

function buildUsersRoutes({ usersService, requestsService }) {
  return [
    { method: 'POST', path: '/users/telegram-upsert', handler: ({ body }) => usersService.telegramUpsert(body) },
    { method: 'GET', path: '/users/:user_id/requests', handler: ({ params, auth }) => requestsService.getMyRequests(requireSameActor(auth, params.user_id)) }
  ];
}
module.exports = { buildUsersRoutes };
