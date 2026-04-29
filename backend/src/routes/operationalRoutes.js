const { AppError } = require('../domain/errors');

function buildOperationalRoutes({ serviceName, getStorageMode, checkReadiness }) {
  return [
    {
      method: 'GET',
      path: '/health',
      handler: () => ({
        ok: true,
        service: serviceName,
        storage: getStorageMode(),
        timestamp: new Date().toISOString()
      })
    },
    {
      method: 'GET',
      path: '/ready',
      handler: () => {
        const readiness = checkReadiness();
        if (!readiness.ok) {
          throw new AppError('SERVICE_UNAVAILABLE', readiness.error || 'Service is not ready');
        }
        return {
          ok: true,
          storage: getStorageMode(),
          checks: readiness.checks,
          timestamp: new Date().toISOString()
        };
      }
    }
  ];
}

module.exports = { buildOperationalRoutes };
