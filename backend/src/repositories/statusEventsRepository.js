class StatusEventsRepository {
  constructor(db) { this.s = db.state; }
  addRequestEvent(e) { this.s.requestEvents.push(e); }
  addResponseEvent(e) { this.s.responseEvents.push(e); }
  listRequestEvents(requestId) { return this.s.requestEvents.filter((e) => e.request_id === requestId); }
  listResponseEvents(responseId) { return this.s.responseEvents.filter((e) => e.response_id === responseId); }
}
module.exports = { StatusEventsRepository };
