export const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/+$/,
  ""
);

export const apiRoot = configuredApiBase
  ? configuredApiBase.endsWith("/api")
    ? configuredApiBase
    : `${configuredApiBase}/api`
  : "/api";

export async function requestApi(url, options = {}) {
  const response = await fetch(url, options);
  let result = {};
  try {
    result = await response.json();
  } catch {
    result = {};
  }

  if (!response.ok || result.success === false) {
    throw new Error(
      result.message || `Request failed with status ${response.status}.`
    );
  }
  return result;
}
