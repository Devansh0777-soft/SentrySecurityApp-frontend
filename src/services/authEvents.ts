/**
 * A tiny pub/sub used to signal that the current session has become invalid
 * (e.g. a protected request returned 401 and could not be recovered). The API
 * client emits this; the AuthContext listens and performs a single, centralised
 * logout. Keeping it decoupled avoids a circular import between the API layer
 * and the React auth state, and the "already handled" guard prevents repeated
 * logouts / infinite refresh loops.
 */
type UnauthorizedListener = () => void;

const listeners = new Set<UnauthorizedListener>();
let handlingUnauthorized = false;

export const onUnauthorized = (listener: UnauthorizedListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const emitUnauthorized = () => {
  if (handlingUnauthorized) return;
  handlingUnauthorized = true;
  listeners.forEach(listener => listener());
  // Allow future unauthorized events once the current logout settles.
  setTimeout(() => {
    handlingUnauthorized = false;
  }, 0);
};
