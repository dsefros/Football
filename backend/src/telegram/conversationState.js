const states = new Map();
function setState(chatId, state) { states.set(chatId, state); }
function getState(chatId) { return states.get(chatId) || null; }
function clearState(chatId) { states.delete(chatId); }
module.exports = { setState, getState, clearState };
