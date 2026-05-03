class ExpireRequestsService {
  constructor(db, requestsService, responsesService) {
    this.db = db;
    this.requestsService = requestsService;
    this.responsesService = responsesService;
  }

  run() {
    return this.db.transaction(() => {
      const reqs = this.requestsService.getExpirableActiveRequests();
      const out = [];
      for (const req of reqs) {
        const request = this.requestsService.markExpired(req.id);
        const responses = this.responsesService.expireRequestedByRequest(req.id);
        out.push({ request, responses });
      }
      return out;
    });
  }
}
module.exports = { ExpireRequestsService };
