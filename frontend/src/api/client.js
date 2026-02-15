const API_BASE_URL = 'http://127.0.0.1:8000';

export async function predictRisk(payload) {
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
}

export async function fetchAnalytics() {
  const response = await fetch(`${API_BASE_URL}/analytics`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Analytics request failed: ${errorText}`);
  }

  return response.json();
}
