const mongoose = require('mongoose');

const SESSION_COOKIE_NAMES = [
  '__Secure-authjs.session-token',
  '__Host-authjs.session-token',
  'authjs.session-token',
  // Accept the legacy names only to avoid silently downgrading a valid session
  // during an Auth.js upgrade. New sessions use the authjs names above.
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
];

const guestIdentity = () => ({ kind: 'guest' });

function parseCookies(cookieHeader) {
  if (typeof cookieHeader !== 'string' || !cookieHeader) return new Map();

  return cookieHeader.split(';').reduce((cookies, pair) => {
    const separator = pair.indexOf('=');
    if (separator < 1) return cookies;
    const name = pair.slice(0, separator).trim();
    const encodedValue = pair.slice(separator + 1).trim();
    if (!name || !encodedValue) return cookies;
    try {
      cookies.set(name, decodeURIComponent(encodedValue));
    } catch {
      // A malformed cookie is not a usable authenticated session.
    }
    return cookies;
  }, new Map());
}

function sessionTokenFromCookieHeader(cookieHeader) {
  const cookies = parseCookies(cookieHeader);
  for (const name of SESSION_COOKIE_NAMES) {
    const token = cookies.get(name);
    if (token) return token;
  }
  return null;
}

function accountIdentity(userId) {
  if (!mongoose.isValidObjectId(userId)) return guestIdentity();
  return { kind: 'account', userId: new mongoose.Types.ObjectId(userId).toString() };
}

async function findSessionUser(sessionToken) {
  let database = mongoose.connection.db;
  if (!database) {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) return null;

    if (mongoose.connection.readyState === 2) await mongoose.connection.asPromise();
    else if (mongoose.connection.readyState !== 1) await mongoose.connect(mongoUri);
    database = mongoose.connection.db;
  }
  if (!database) return null;

  const session = await database.collection('sessions').findOne(
    { sessionToken, expires: { $gt: new Date() } },
    { projection: { userId: 1 } },
  );
  if (!session?.userId) return null;

  const user = await database.collection('users').findOne(
    { _id: session.userId },
    { projection: { _id: 1 } },
  );
  return user ? session.userId : null;
}

function createSocketIdentityResolver({ findUserIdBySessionToken = findSessionUser } = {}) {
  return async function resolveSocketIdentity(socket) {
    const sessionToken = sessionTokenFromCookieHeader(socket.handshake?.headers?.cookie);
    if (!sessionToken) return guestIdentity();

    try {
      const userId = await findUserIdBySessionToken(sessionToken);
      return accountIdentity(userId);
    } catch {
      // Authentication lookup failures never elevate a socket. The connection
      // remains a guest connection so casual play is still available.
      return guestIdentity();
    }
  };
}

module.exports = {
  accountIdentity,
  createSocketIdentityResolver,
  guestIdentity,
  sessionTokenFromCookieHeader,
};
