const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ?? (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api');

const RETRY_DELAY_MS = 600;
let ACCESS_TOKEN = '';

export function setAccessToken(token) {
  ACCESS_TOKEN = token ?? '';
}

function withAuthHeaders(headers = {}) {
  if (!ACCESS_TOKEN) return headers;
  return {
    ...headers,
    Authorization: `Bearer ${ACCESS_TOKEN}`,
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function predictRisk(payload, options = {}) {
  const retries = options.retries ?? 1;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Prediction failed: ${errorText}`);
      }

      return response.json();
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await wait(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      console.error('Predict API fetch failed', {
        baseUrl: API_BASE_URL,
        endpoint: '/predict',
        payload,
        retries,
        error,
      });
    }
  }

  throw lastError;
}

export async function checkHealth() {
  const response = await fetch(`${API_BASE_URL}/`);
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return response.json();
}

export async function fetchAnalytics() {
  try {
    const response = await fetch(`${API_BASE_URL}/analytics`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Analytics request failed: ${errorText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Analytics API fetch failed', {
      baseUrl: API_BASE_URL,
      endpoint: '/analytics',
      error,
    });
    throw error;
  }
}

export async function predictBatch(items) {
  const response = await fetch(`${API_BASE_URL}/predict/batch`, {
    method: 'POST',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Batch prediction failed: ${errorText}`);
  }

  return response.json();
}

export async function fetchAuditLogs(options = {}) {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const purpose = options.purpose ?? '';
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (purpose) params.set('purpose', purpose);

  const response = await fetch(`${API_BASE_URL}/audit-logs?${params.toString()}`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Audit logs request failed: ${errorText}`);
  }
  return response.json();
}

export async function fetchModelRegistry() {
  const response = await fetch(`${API_BASE_URL}/model-registry`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Model registry request failed: ${errorText}`);
  }
  return response.json();
}

export async function fetchFairnessMetrics() {
  const response = await fetch(`${API_BASE_URL}/fairness`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fairness metrics request failed: ${errorText}`);
  }
  return response.json();
}

export async function googleLogin(idToken, requestedRole) {
  const response = await fetch(`${API_BASE_URL}/auth/google-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: idToken, requested_role: requestedRole }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google login failed: ${errorText}`);
  }

  return response.json();
}

export async function createCase(payload) {
  const response = await fetch(`${API_BASE_URL}/cases`, {
    method: 'POST',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Create case failed: ${errorText}`);
  }

  return response.json();
}

export async function listCases(options = {}) {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 50),
    offset: String(options.offset ?? 0),
  });
  if (options.status) params.set('status', options.status);
  if (options.assigned_to) params.set('assigned_to', options.assigned_to);

  const response = await fetch(`${API_BASE_URL}/cases?${params.toString()}`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`List cases failed: ${errorText}`);
  }
  return response.json();
}

export async function updateCase(caseId, payload) {
  const response = await fetch(`${API_BASE_URL}/cases/${caseId}`, {
    method: 'PATCH',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Update case failed: ${errorText}`);
  }
  return response.json();
}

export async function analyzeDocument(payload) {
  const response = await fetch(`${API_BASE_URL}/documents/analyze`, {
    method: 'POST',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Document analyze failed: ${errorText}`);
  }
  return response.json();
}

export async function fetchMonitoring() {
  const response = await fetch(`${API_BASE_URL}/monitoring`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Monitoring request failed: ${errorText}`);
  }
  return response.json();
}

export async function fetchGovernanceComparison(challengerVersion = '1.1.0') {
  const response = await fetch(`${API_BASE_URL}/governance/comparison?challenger_version=${encodeURIComponent(challengerVersion)}`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Governance comparison failed: ${errorText}`);
  }
  return response.json();
}

export async function createReportFromCase(caseId, title = '') {
  const params = new URLSearchParams();
  if (title) params.set('title', title);
  const suffix = params.toString() ? `?${params.toString()}` : '';

  const response = await fetch(`${API_BASE_URL}/reports/from-case/${caseId}${suffix}`, {
    method: 'POST',
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Create report failed: ${errorText}`);
  }
  return response.json();
}

export async function listReports(caseId, options = {}) {
  const params = new URLSearchParams({
    case_id: String(caseId),
    limit: String(options.limit ?? 50),
    offset: String(options.offset ?? 0),
  });

  const response = await fetch(`${API_BASE_URL}/reports?${params.toString()}`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`List reports failed: ${errorText}`);
  }
  return response.json();
}

export async function createReportShareLink(reportId, ttlMinutes = 60) {
  const response = await fetch(`${API_BASE_URL}/reports/${reportId}/share?ttl_minutes=${encodeURIComponent(ttlMinutes)}`, {
    method: 'POST',
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Create share link failed: ${errorText}`);
  }
  return response.json();
}

export async function fetchAuditPackage(caseId) {
  const response = await fetch(`${API_BASE_URL}/reports/audit-package?case_id=${encodeURIComponent(caseId)}`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Audit package export failed: ${errorText}`);
  }
  return response.json();
}

export async function fetchPublicReport(token) {
  const response = await fetch(`${API_BASE_URL}/public/reports/${encodeURIComponent(token)}`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Public report fetch failed: ${errorText}`);
  }
  return response.json();
}
