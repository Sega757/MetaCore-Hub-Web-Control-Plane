export const DEFAULT_A2A_ALLOWLIST: readonly string[] = [
  'agents.metacore.internal',
  'registry.metacore.dev',
  'a2a.trusted-partner.io',
] as const;

export const REQUIRED_EXTENSION_URI = 'urn:metacore:ext:fsm-deterministic-v1';

export type SsrfBlockCategory =
  | 'ALLOWED'
  | 'INVALID_URL'
  | 'FORBIDDEN_SCHEME'
  | 'CLOUD_METADATA'
  | 'LOOPBACK'
  | 'PRIVATE_NETWORK'
  | 'NOT_IN_ALLOWLIST';

export interface SsrfValidationResult {
  allowed: boolean;
  category: SsrfBlockCategory;
  reason: string;
  hostname: string | null;
  protocol: string | null;
}

export interface AgentCardV03 {
  schemaVersion: '0.3';
  agentId: string;
  name: string;
  endpoint: string;
  capabilities: {
    streaming: boolean;
    patchProposal: boolean;
  };
  auth: {
    type: 'bearer';
  };
}

export interface AgentCardV10 {
  schemaVersion: '1.0';
  promotedFrom: '0.3';
  agentId: string;
  name: string;
  endpoint: string;
  capabilities: {
    streaming: boolean;
    patchProposal: boolean;
    stateAuthority: 'DAEMON_ONLY';
    extensions: string[];
  };
  securitySchemes: {
    bearerAuth: {
      type: 'http';
      scheme: 'bearer';
    };
  };
  hardening: {
    ssrfVerified: true;
    extensionHeaderConfirmed: true;
    legacyDowngradePermitted: false;
  };
}

export interface A2AFetchCardResult {
  ok: boolean;
  stage: 'SSRF_GUARD' | 'EXTENSION_CONFIRMATION' | 'PROMOTED';
  ssrf: SsrfValidationResult;
  responseHeaders: Record<string, string>;
  errorCode?: 'SSRF_BLOCKED' | 'EXTENSION_HEADER_MISSING';
  errorMessage?: string;
  cardV03?: AgentCardV03;
  cardV10?: AgentCardV10;
}

function isIpv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function parseIpv4Octets(host: string): number[] | null {
  if (!isIpv4(host)) return null;
  const parts = host.split('.').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return parts;
}

export function validateSsrfUrl(rawUrl: string, allowlist: readonly string[]): SsrfValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      allowed: false,
      category: 'INVALID_URL',
      reason: 'Empty URL provided to fetch_card().',
      hostname: null,
      protocol: null,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      allowed: false,
      category: 'INVALID_URL',
      reason: `Malformed URL syntax: "${trimmed}".`,
      hostname: null,
      protocol: null,
    };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'https:' && protocol !== 'http:') {
    return {
      allowed: false,
      category: 'FORBIDDEN_SCHEME',
      reason: `Forbidden URI scheme "${protocol}". Only http/https are inspected by A2A transport.`,
      hostname: parsed.hostname,
      protocol,
    };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  // Explicit cloud metadata endpoints
  if (
    host === '169.254.169.254' ||
    host === 'metadata.google.internal' ||
    host === 'metadata.goog' ||
    host === '100.100.100.200'
  ) {
    return {
      allowed: false,
      category: 'CLOUD_METADATA',
      reason: `SSRF Blocked [CLOUD_METADATA]: Access to instance metadata host "${host}" is strictly forbidden.`,
      hostname: host,
      protocol,
    };
  }

  // Loopback hosts
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0' || host.endsWith('.localhost')) {
    return {
      allowed: false,
      category: 'LOOPBACK',
      reason: `SSRF Blocked [LOOPBACK]: Target "${host}" resolves to local loopback interface.`,
      hostname: host,
      protocol,
    };
  }

  // IPv4 private / link-local / loopback ranges
  const octets = parseIpv4Octets(host);
  if (octets) {
    const [a, b] = octets;
    if (a === 127 || a === 0) {
      return {
        allowed: false,
        category: 'LOOPBACK',
        reason: `SSRF Blocked [LOOPBACK]: IPv4 range ${host} is loopback/unspecified.`,
        hostname: host,
        protocol,
      };
    }
    if (a === 169 && b === 254) {
      return {
        allowed: false,
        category: 'CLOUD_METADATA',
        reason: `SSRF Blocked [LINK_LOCAL/METADATA]: 169.254.0.0/16 is blocked.`,
        hostname: host,
        protocol,
      };
    }
    if (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    ) {
      return {
        allowed: false,
        category: 'PRIVATE_NETWORK',
        reason: `SSRF Blocked [RFC1918/CGNAT]: Private network IP "${host}" cannot be queried by A2A fetcher.`,
        hostname: host,
        protocol,
      };
    }
  }

  // IPv6 private/link-local
  if (host.includes(':') && (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80'))) {
    return {
      allowed: false,
      category: 'PRIVATE_NETWORK',
      reason: `SSRF Blocked [IPv6_PRIVATE]: Local/ULA IPv6 address "${host}" is prohibited.`,
      hostname: host,
      protocol,
    };
  }

  // Strict allowlist check
  const normalizedAllowlist = allowlist.map((d) => d.trim().toLowerCase()).filter(Boolean);
  const matched = normalizedAllowlist.some((allowedHost) => host === allowedHost);
  if (!matched) {
    return {
      allowed: false,
      category: 'NOT_IN_ALLOWLIST',
      reason: `SSRF Blocked [ALLOWLIST_DENY]: Host "${host}" is not present in the configured A2A allowlist.`,
      hostname: host,
      protocol,
    };
  }

  return {
    allowed: true,
    category: 'ALLOWED',
    reason: `SSRF Allowlist PASS: "${host}" matched configured trust registry.`,
    hostname: host,
    protocol,
  };
}

/**
 * Fail-fast confirmation of X-A2A-Extensions header.
 * Never silently downgrades to legacy v0.3 behavior if an intermediate proxy strips the header.
 */
export function requireExtensionConfirmed(
  headers: Record<string, string>,
  requiredExtension = REQUIRED_EXTENSION_URI
): { ok: true } | { ok: false; reason: string } {
  const headerKey = Object.keys(headers).find((k) => k.toLowerCase() === 'x-a2a-extensions');
  if (!headerKey || !headers[headerKey]?.trim()) {
    return {
      ok: false,
      reason:
        'FAIL-FAST [require_extension_confirmed]: Missing "X-A2A-Extensions" response header (likely stripped by intermediate proxy). Refusing silent downgrade to legacy mode.',
    };
  }
  const confirmedList = headers[headerKey]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!confirmedList.includes(requiredExtension)) {
    return {
      ok: false,
      reason: `FAIL-FAST [require_extension_confirmed]: Required extension "${requiredExtension}" not confirmed in X-A2A-Extensions header.`,
    };
  }

  return { ok: true };
}

export function promoteAgentCardV03ToV10(v03: AgentCardV03): AgentCardV10 {
  return {
    schemaVersion: '1.0',
    promotedFrom: '0.3',
    agentId: v03.agentId,
    name: v03.name,
    endpoint: v03.endpoint,
    capabilities: {
      streaming: v03.capabilities.streaming,
      patchProposal: v03.capabilities.patchProposal,
      stateAuthority: 'DAEMON_ONLY',
      extensions: [REQUIRED_EXTENSION_URI],
    },
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: v03.auth.type,
      },
    },
    hardening: {
      ssrfVerified: true,
      extensionHeaderConfirmed: true,
      legacyDowngradePermitted: false,
    },
  };
}

export function simulateFetchCard(
  rawUrl: string,
  options: {
    allowlist: readonly string[];
    simulateProxyStripHeader: boolean;
  }
): A2AFetchCardResult {
  const ssrf = validateSsrfUrl(rawUrl, options.allowlist);
  if (!ssrf.allowed) {
    return {
      ok: false,
      stage: 'SSRF_GUARD',
      ssrf,
      responseHeaders: {},
      errorCode: 'SSRF_BLOCKED',
      errorMessage: ssrf.reason,
    };
  }

  const responseHeaders: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-A2A-Protocol': '1.0',
    'Cache-Control': 'no-store',
  };

  if (!options.simulateProxyStripHeader) {
    responseHeaders['X-A2A-Extensions'] = `${REQUIRED_EXTENSION_URI}, urn:a2a:card-promote-v1`;
  }

  const extCheck = requireExtensionConfirmed(responseHeaders);
  if (!extCheck.ok) {
    return {
      ok: false,
      stage: 'EXTENSION_CONFIRMATION',
      ssrf,
      responseHeaders,
      errorCode: 'EXTENSION_HEADER_MISSING',
      errorMessage: extCheck.reason,
    };
  }

  const cleanHost = ssrf.hostname ?? 'agents.metacore.internal';
  const cardV03: AgentCardV03 = {
    schemaVersion: '0.3',
    agentId: `a2a-${cleanHost.replace(/[^a-z0-9]/g, '-')}`,
    name: 'MetaCore Worker Agent (Legacy v0.3 Manifest)',
    endpoint: rawUrl.trim(),
    capabilities: {
      streaming: true,
      patchProposal: true,
    },
    auth: {
      type: 'bearer',
    },
  };

  const cardV10 = promoteAgentCardV03ToV10(cardV03);

  return {
    ok: true,
    stage: 'PROMOTED',
    ssrf,
    responseHeaders,
    cardV03,
    cardV10,
  };
}
