const states = new Map();
function setState(chatId, state) { states.set(chatId, state); }
function getState(chatId) { return states.get(chatId) || null; }
module.exports = { setState, getState };
