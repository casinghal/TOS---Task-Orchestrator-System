export type GuardResult = {
  ok: boolean;
  message?: string;
};

export function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

export function emailDomainOf(email: string) {
  const parts = email.trim().toLowerCase().split("@");
  return parts.length === 2 ? parts[1] : "";
}

export function emailMatchesDomain(email: string, domain: string) {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) return true;
  return emailDomainOf(email) === normalizedDomain;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidDomain(domain: string) {
  const normalized = normalizeDomain(domain);
  if (!normalized) return true;
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(normalized);
}

export function validateUserForFirm(email: string, firmDomain: string, isPlatformOwner = false): GuardResult {
  if (!isValidEmail(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (isPlatformOwner) {
    return { ok: true };
  }
  const normalizedDomain = normalizeDomain(firmDomain);
  if (!normalizedDomain) {
    return { ok: true };
  }
  if (!emailMatchesDomain(email, normalizedDomain)) {
    return { ok: false, message: "Email must use @" + normalizedDomain + " for this firm workspace." };
  }
  return { ok: true };
}

export function validateFirmDomain(domain: string): GuardResult {
  if (!isValidDomain(domain)) {
    return { ok: false, message: "Enter a valid email domain, for example example.com." };
  }
  return { ok: true };
}
