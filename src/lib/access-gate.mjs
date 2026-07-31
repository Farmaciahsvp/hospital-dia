const BASIC_PREFIX = "Basic ";

function constantTimeEqual(left, right) {
  const a = String(left);
  const b = String(right);
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }

  return difference === 0;
}

export function decodeBasicCredentials(authorization) {
  if (typeof authorization !== "string" || !authorization.startsWith(BASIC_PREFIX)) {
    return null;
  }

  const token = authorization.slice(BASIC_PREFIX.length).trim();
  if (!token) return null;

  try {
    const binary = atob(token);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const separator = decoded.indexOf(":");

    if (separator < 1) return null;

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

export function isAccessGateEnabled({ nodeEnv, vercel, mode }) {
  return nodeEnv === "production" || vercel === "1" || mode === "on";
}

export function evaluateAccess({
  enabled,
  expectedUsername,
  expectedPassword,
  authorization,
}) {
  if (!enabled) return "allow";

  if (!expectedUsername || !expectedPassword) {
    return "misconfigured";
  }

  const credentials = decodeBasicCredentials(authorization);
  if (!credentials) return "unauthorized";

  const usernameMatches = constantTimeEqual(credentials.username, expectedUsername);
  const passwordMatches = constantTimeEqual(credentials.password, expectedPassword);

  return usernameMatches && passwordMatches ? "allow" : "unauthorized";
}
