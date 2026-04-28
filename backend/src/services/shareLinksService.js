const crypto = require('crypto');
function createShareToken() { return crypto.randomBytes(8).toString('base64url'); }
function createPublicSlug() { return crypto.randomBytes(6).toString('hex'); }
function buildShareUrl(botUsername, token) { return `https://t.me/${botUsername}?start=r_${token}`; }
function buildShareText(url) { return `Найдена заявка на футбол: ${url}`; }
module.exports = { createShareToken, createPublicSlug, buildShareUrl, buildShareText };
