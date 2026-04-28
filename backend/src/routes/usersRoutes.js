function buildUsersRoutes({ usersService, requestsService }) {
  return [
    { method: 'POST', path: '/users/telegram-upsert', handler: ({ body }) => usersService.telegramUpsert(body) },
    { method: 'GET', path: '/users/:user_id/requests', handler: ({ params }) => requestsService.getMyRequests(params.user_id) }
  ];
}
module.exports = { buildUsersRoutes };
