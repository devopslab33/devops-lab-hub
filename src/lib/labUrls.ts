export function buildLabAppOpenUrl(sessionId: string, port: string) {
  const path = `/lab/${encodeURIComponent(sessionId)}/${encodeURIComponent(port)}`;
  if (port === "443") {
    return `https://${window.location.host}${path}`;
  }
  return path;
}

export function buildLabLoadingUrl(sessionId: string, port: string) {
  return `/lab-loading?sessionId=${encodeURIComponent(sessionId)}&port=${encodeURIComponent(port)}`;
}
