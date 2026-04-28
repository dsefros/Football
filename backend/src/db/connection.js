function createDb() {
  return {
    state: {
      users: new Map(),
      usersByTelegram: new Map(),
      requests: new Map(),
      requestsByToken: new Map(),
      responses: new Map(),
      responsesByRequestUser: new Map(),
      callbackTokens: new Map(),
      requestEvents: [],
      responseEvents: []
    }
  };
}
module.exports = { createDb };
