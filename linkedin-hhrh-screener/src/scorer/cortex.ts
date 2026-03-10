// src/scorer/cortex.ts
// Snowflake Cortex AI Complete client via the SQL REST API.
// Replaces direct Anthropic API calls — uses the user's Snowflake PAT token.
//
// Chrome MV3 service workers may strip the Authorization header on cross-origin
// fetch requests.  We work around this with a belt-and-suspenders approach:
// 1. Always include auth headers in the fetch call (works in tests + most envs)
// 2. Also install a declarativeNetRequest session rule to inject them at the
//    network level (ensures they arrive even if Chrome strips them from fetch)

export interface CortexCredentials {
  accountUrl: string; // e.g. "https://lxb35875.snowflakecomputing.com"
  patToken: string;   // Programmatic Access Token
  warehouse: string;  // e.g. "COMPUTE_WH"
}

export interface CortexResponse {
  text: string;
  error?: string;
}

// Incrementing IDs so concurrent calls don't clobber each other's DNR rules.
let nextRuleId = 1;

/**
 * Try to install a declarativeNetRequest session rule that injects auth headers.
 * Silently no-ops if the API is unavailable (tests, non-Chrome, etc.).
 * Returns a cleanup function.
 */
async function installAuthRule(
  creds: CortexCredentials,
): Promise<{ cleanup: () => Promise<void> }> {
  const noop = { cleanup: async () => {} };

  if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest) {
    return noop;
  }

  const ruleId = nextRuleId++;

  try {
    const url = new URL(creds.accountUrl);

    await chrome.declarativeNetRequest.updateSessionRules({
      addRules: [{
        id: ruleId,
        priority: 1,
        action: {
          type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
          requestHeaders: [
            {
              header: 'Authorization',
              operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
              value: `Bearer ${creds.patToken}`,
            },
            {
              header: 'X-Snowflake-Authorization-Token-Type',
              operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
              value: 'PROGRAMMATIC_ACCESS_TOKEN',
            },
          ],
        },
        condition: {
          urlFilter: `||${url.hostname}/api/v2/statements`,
          resourceTypes: ['xmlhttprequest' as chrome.declarativeNetRequest.ResourceType],
        },
      }],
    });
  } catch {
    return noop;
  }

  return {
    cleanup: async () => {
      try {
        await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] });
      } catch { /* ignore */ }
    },
  };
}

/**
 * Calls Snowflake Cortex COMPLETE via the SQL REST API.
 */
export async function cortexComplete(
  creds: CortexCredentials,
  prompt: string,
  model = 'mistral-large2',
): Promise<CortexResponse> {
  const escapedPrompt = prompt.replace(/'/g, "''");
  const statement = `SELECT SNOWFLAKE.CORTEX.COMPLETE('${model}', '${escapedPrompt}') AS response`;

  const { cleanup } = await installAuthRule(creds);

  let response: Response;
  try {
    response = await fetch(`${creds.accountUrl}/api/v2/statements`, {
      method: 'POST',
      signal: AbortSignal.timeout(60_000),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${creds.patToken}`,
        'X-Snowflake-Authorization-Token-Type': 'PROGRAMMATIC_ACCESS_TOKEN',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        statement,
        warehouse: creds.warehouse,
        timeout: 60,
      }),
    });
  } catch {
    await cleanup();
    return { text: '', error: 'Network error connecting to Snowflake' };
  }

  await cleanup();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return { text: '', error: 'Snowflake auth failed — check your PAT token in Options' };
    }
    return { text: '', error: `Snowflake API error ${response.status}` };
  }

  const data = await response.json() as SqlApiResponse;

  if (data.code && data.code !== '090001') {
    return { text: '', error: `Snowflake SQL error: ${data.message ?? data.code}` };
  }

  const text = data.data?.[0]?.[0]?.trim() ?? '';
  if (!text) {
    return { text: '', error: 'Cortex returned empty response' };
  }

  return { text };
}

/**
 * Validates Snowflake credentials by running a simple query.
 */
export async function validateCortexCredentials(
  creds: CortexCredentials,
): Promise<{ valid: boolean; error?: string }> {
  const { cleanup } = await installAuthRule(creds);

  let response: Response;
  try {
    response = await fetch(`${creds.accountUrl}/api/v2/statements`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${creds.patToken}`,
        'X-Snowflake-Authorization-Token-Type': 'PROGRAMMATIC_ACCESS_TOKEN',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        statement: 'SELECT 1',
        warehouse: creds.warehouse,
        timeout: 15,
      }),
    });
  } catch (err) {
    await cleanup();
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Network error: ${msg}` };
  }

  await cleanup();

  if (response.status === 401 || response.status === 403) {
    return { valid: false, error: 'Authentication failed — check your PAT token' };
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json() as { message?: string; code?: string };
      detail = body.message ?? body.code ?? '';
    } catch { /* ignore parse errors */ }
    return { valid: false, error: `Snowflake HTTP ${response.status}${detail ? ': ' + detail : ''}` };
  }

  return { valid: true };
}

// Snowflake SQL API response shape (partial)
interface SqlApiResponse {
  code?: string;
  message?: string;
  data?: string[][];
  resultSetMetaData?: { numRows: number };
}
