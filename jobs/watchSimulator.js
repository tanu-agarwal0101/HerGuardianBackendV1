import axios from "axios";

let intervalHandle = null;

function generateRandomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function generateTelemetry(userId) {
  const now = new Date();
  const baseLat = 28.6300;
  const baseLon = 34.5600;
  const jitterLat = generateRandomBetween(-0.0009, 0.0009);
  const jitterLon = generateRandomBetween(-0.0009, 0.0009);

  const heartRate = Math.round(generateRandomBetween(65, 140));
  const fallDetected = Math.random() > 0.98;

  return {
    userId,
    heartRate,
    location: { lat: +(baseLat + jitterLat).toFixed(6), lon: +(baseLon + jitterLon).toFixed(6) },
    fallDetected,
    triggeredAt: now.toISOString(),
  };
}

export function startWatchSimulator(options = {}) {
  if (intervalHandle) return; 
    const {
    backendBaseUrl = process.env.BACKEND_BASE_URL || `http://localhost:${process.env.PORT || 5000}`,
    endpointPath = "/watch/data",
    userId = process.env.SIM_USER_ID || "64f8c2c9e3a2d51234abcd90",
    intervalMs = Number(process.env.SIM_INTERVAL_MS || 5000),
    enabled = true,
    authToken = process.env.SIM_AUTH_TOKEN || null,
  } = options;

  if (!enabled) return;

  const url = `${backendBaseUrl}${endpointPath}`;

  intervalHandle = setInterval(async () => {
    const payload = generateTelemetry(userId);
    try {
      const headers = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      await axios.post(url, payload, { 
        timeout: 4000,
        headers
      });
    } catch (_err) {
      // Simulator send failure — non-critical
    }
  }, intervalMs);
}

export function stopWatchSimulator() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
