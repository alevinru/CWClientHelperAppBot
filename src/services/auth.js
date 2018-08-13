export function getAuthToken(session) {
  try {
    const { auth: { token } } = session;
    return token;
  } catch (e) {
    throw new Error('Not authorized');
  }
}

export function setAuth(session, authData) {
  session.auth = authData;
}
