function toDbBool(value) { return value ? 1 : 0; }
function fromDbBool(value) { return !!value; }
function toJson(value) { return value == null ? null : JSON.stringify(value); }
function fromJson(value, fallback = null) { return value == null ? fallback : JSON.parse(value); }

module.exports = { toDbBool, fromDbBool, toJson, fromJson };
