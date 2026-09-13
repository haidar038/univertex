/**
 * Device / browser fingerprinting utilities.
 *
 * We use a stable, lightweight, *anonymous* fingerprint to detect "is this the
 * same browser we saw last time?" and to render a human-friendly label for the
 * device. We never fingerprint sensitive attributes and never send the raw
 * fingerprint to any third party.
 */

export interface DeviceFingerprint {
  /** SHA-256 hash of (navigator.userAgent + screen + tz + language). */
  hash: string;
  /** Best-effort human label, e.g. "Chrome on Windows". */
  label: string;
  /** Raw user agent (only kept client-side). */
  userAgent: string;
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder().encode(input);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', encoder);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback (very old browsers): a non-crypto hash. Server still gets a
  // deterministic string so sessions can be matched.
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return `fallback-${h}`;
}

function detectOS(): string {
  const ua = navigator.userAgent;
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown OS';
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  if (/Firefox\//.test(ua)) return 'Firefox';
  return 'Unknown Browser';
}

function detectDeviceType(): string {
  const ua = navigator.userAgent;
  if (/Mobile|Android|iPhone|iPod/.test(ua)) return 'Mobile';
  if (/iPad|Tablet/.test(ua)) return 'Tablet';
  return 'Desktop';
}

/**
 * Build a DeviceFingerprint for the current browser. The fingerprint is
 * deterministic across reloads in the same browser but differs between
 * browsers / OS combinations.
 */
export async function buildDeviceFingerprint(): Promise<DeviceFingerprint> {
  const components = [
    navigator.userAgent,
    navigator.language,
    `${(navigator.languages || []).join(',')}`,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    `${navigator.hardwareConcurrency || 0}`,
    `${(navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0}`,
  ];

  const hashInput = components.join('|');
  const hash = await sha256(hashInput);

  const label = `${detectBrowser()} on ${detectOS()} (${detectDeviceType()})`;

  return { hash, label, userAgent: navigator.userAgent };
}
