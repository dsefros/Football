function buildTelegramRoutes({ botAdapter, telegramResponseDelivery, logger = console }) {
  return [
    {
      method: 'POST',
      path: '/telegram/webhook',
      handler: ({ body }) => {
        const structured = botAdapter.handleUpdate(body);
        if (telegramResponseDelivery) {
          Promise.resolve(telegramResponseDelivery.deliver(body, structured)).catch((err) => {
            logger.error('Telegram transport delivery failed', err);
          });
        }
        return structured;
      }
    }
  ];
}
module.exports = { buildTelegramRoutes };
