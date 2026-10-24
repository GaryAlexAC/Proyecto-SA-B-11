import http from 'k6/http';
import { check, fail, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN;
const CLIENT_TOKEN = __ENV.K6_TOKEN;
const SOURCE_ACCOUNT = __ENV.K6_SOURCE_ACCOUNT;
const SERVICE_ID = __ENV.K6_SERVICE_ID;
const USERS = Number(__ENV.K6_PAYMENT_USERS || 5);
const TIMEOUT_MS = Number(__ENV.K6_TIMEOUT_MS || 3000);

export const options = {
  scenarios: {
    payment_timeout: {
      executor: 'ramping-vus',
      exec: 'createPayment',
      startVUs: 0,
      stages: [
        { duration: '15s', target: Math.max(1, Math.ceil(USERS / 2)) },
        { duration: '1m', target: USERS },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '30s',
      tags: { scenario: 'payment-timeout' },
    },
  },
  thresholds: {
    'http_req_duration{scenario:payment-timeout}': ['p(95)<5000'],
    checks: ['rate>0.95'],
  },
};

function required(value, name) {
  if (!value) fail(`Falta la variable de entorno ${name}`);
  return value;
}

function login(usernameName, passwordName, label) {
  const response = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      username: required(__ENV[usernameName], usernameName),
      password: required(__ENV[passwordName], passwordName),
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { scenario: 'auth' },
    },
  );

  if (![200, 201].includes(response.status)) {
    fail(`Login ${label} falló: HTTP ${response.status}`);
  }

  const token = response.json('accessToken');
  if (!token) fail(`Login ${label} no devolvió accessToken`);
  return token;
}

function resolveToken(token, usernameName, passwordName, label) {
  return token || login(usernameName, passwordName, label);
}

function adminHeaders(adminToken) {
  return {
    Authorization: `Bearer ${required(adminToken, 'ADMIN_TOKEN o ADMIN_USERNAME/ADMIN_PASSWORD')}`,
    'Content-Type': 'application/json',
    'X-Correlation-Id': 'k6-payment-timeout-config',
  };
}

function updateSimulation(config, adminToken) {
  const response = http.patch(
    `${BASE_URL}/api/payments/simulation/config`,
    JSON.stringify(config),
    {
      headers: adminHeaders(adminToken),
      tags: { scenario: 'payment-timeout-config' },
    },
  );

  if (response.status !== 200) {
    fail(`No se pudo actualizar la simulación: HTTP ${response.status}`);
  }
}

export function setup() {
  const adminToken = resolveToken(
    ADMIN_TOKEN,
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD',
    'admin',
  );
  const clientToken = resolveToken(
    CLIENT_TOKEN,
    'K6_USERNAME',
    'K6_PASSWORD',
    'cliente',
  );
  required(SOURCE_ACCOUNT, 'K6_SOURCE_ACCOUNT');
  required(SERVICE_ID, 'K6_SERVICE_ID');

  const current = http.get(`${BASE_URL}/api/payments/simulation/config`, {
    headers: adminHeaders(adminToken),
    tags: { scenario: 'payment-timeout-config' },
  });
  if (current.status !== 200) {
    fail(`No se pudo leer la simulación actual: HTTP ${current.status}`);
  }

  const originalConfig = current.json();
  updateSimulation({
    failureRatePercent: 0,
    timeoutRatePercent: 100,
    latencyMs: 0,
    timeoutMs: TIMEOUT_MS,
  }, adminToken);

  return { originalConfig, adminToken, clientToken };
}

export function createPayment(data) {
  const correlationId = `k6-payment-timeout-${__VU}-${__ITER}`;
  const response = http.post(
    `${BASE_URL}/api/payments`,
    JSON.stringify({
      sourceAccountId: SOURCE_ACCOUNT,
      serviceId: SERVICE_ID,
    }),
    {
      headers: {
        Authorization: `Bearer ${required(data?.clientToken, 'K6_TOKEN o K6_USERNAME/K6_PASSWORD')}`,
        'Content-Type': 'application/json',
        'X-Correlation-Id': correlationId,
        'Idempotency-Key': `${correlationId}-idempotency`,
      },
      tags: { scenario: 'payment-timeout' },
    },
  );

  check(response, {
    'pago aceptado para procesamiento asíncrono': (res) =>
      [200, 201, 202].includes(res.status),
  });
  sleep(Number(__ENV.K6_SLEEP || 1));
}

export function teardown(data) {
  if (!data?.originalConfig) return;
  updateSimulation(data.originalConfig, data.adminToken);
}
