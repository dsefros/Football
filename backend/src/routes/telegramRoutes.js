function buildTelegramRoutes({ botAdapter }) {
  return [
    { method: 'POST', path: '/telegram/webhook', handler: ({ body }) => botAdapter.handleUpdate(body) }
  ];
}
module.exports = { buildTelegramRoutes };
