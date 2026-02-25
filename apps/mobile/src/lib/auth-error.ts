type AuthErrorListener = () => void;

const listeners = new Set<AuthErrorListener>();
let lastEmitTime = 0;

const DEBOUNCE_MS = 3000;

export const onAuthError = (listener: AuthErrorListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const emitAuthError = () => {
  const now = Date.now();
  if (now - lastEmitTime < DEBOUNCE_MS) {
    return;
  }
  lastEmitTime = now;

  for (const listener of listeners) {
    listener();
  }
};
