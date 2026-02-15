const API_BASE_URL = 'http://127.0.0.1:8000';

const RETRY_DELAY_MS = 600;

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
    headers: { 'Content-Type': 'application/json' },
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

  const response = await fetch(`${API_BASE_URL}/audit-logs?${params.toString()}`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Audit logs request failed: ${errorText}`);
  }
  return response.json();
}

export async function fetchModelRegistry() {
  const response = await fetch(`${API_BASE_URL}/model-registry`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Model registry request failed: ${errorText}`);
  }
  return response.json();
}

export async function fetchFairnessMetrics() {
  const response = await fetch(`${API_BASE_URL}/fairness`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fairness metrics request failed: ${errorText}`);
  }
  return response.json();
}
