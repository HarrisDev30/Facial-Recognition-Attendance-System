let _onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  _onSessionExpired = handler;
}

export function handleSessionExpired() {
  _onSessionExpired?.();
}
