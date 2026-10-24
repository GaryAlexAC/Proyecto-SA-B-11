import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const MODE = (__ENV.K6_MODE || 'all').toLowerCase();
const READ_USERS = Number(__ENV.K6_READ_USERS || 10);
const TRANSFER_USERS = Number(__ENV.K6_TRANSFER_USERS || 5);
const AMOUNT = Number(__ENV.K6_AMOUNT || 1);

function stages(target) {
  return [
    { duration: '30s', target: Math.max(1, Math.ceil(target / 2)) },
    { duration: '2m', target },
    { duration: '1m', target: 0 },
  ];
}

const scenarios = {};
if (MODE === 'read' || MODE === 'all') {
  scenarios.read_load = {
    executor: 'ramping-vus',
    exec: 'readBalance',
    startVUs: 0,
    stages: stages(READ_USERS),
    gracefulRampDown: '30s',
    tags: { scenario: 'read' },
  };
}
if (MODE === 'transfer' || MODE === 'all') {
  scenarios.transfer_load = {
    executor: 'ramping-vus',
    exec: 'createTransfer',
    startVUs: 0,
    stages: stages(TRANSFER_USERS),
    gracefulRampDown: '30s',
    tags: { scenario: 'create' },
  };
}

export const options = {
  scenarios,
  thresholds: {
    'http_req_failed{scenario:read}': ['rate<0.005'],
    'http_req_failed{scenario:create}': ['rate<0.005'],
    'http_req_duration{scenario:read}': ['p(95)<500'],
    'http_req_duration{scenario:create}': ['p(95)<1000'],
    checks: ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

function requireEnv(name) {
  const value = __ENV[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

function login() {
  const response = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      username: requireEnv('K6_USERNAME'),
      password: requireEnv('K6_PASSWORD'),
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { scenario: 'auth' },
    },
  );

  check(response, {
    'login exitoso': (res) => res.status === 200,
  });

  const token = response.json('accessToken');
  if (!token) throw new Error('El login no devolvió accessToken');
  return token;
}

export function setup() {
  const token = __ENV.K6_TOKEN || login();

  if (MODE === 'read' || MODE === 'all') requireEnv('K6_ACCOUNT_ID');
  if (MODE === 'transfer' || MODE === 'all') {
    requireEnv('K6_SOURCE_ACCOUNT');
    requireEnv('K6_TARGET_ACCOUNT');
  }

  return { token };
}

function headers(data, correlationId, idempotencyKey) {
  return {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
    'X-Correlation-Id': correlationId,
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  };
}

export function readBalance(data) {
  const correlationId = `k6-read-${__VU}-${__ITER}`;
  const response = http.get(
    `${BASE_URL}/api/accounts/${__ENV.K6_ACCOUNT_ID}/balance`,
    {
      headers: headers(data, correlationId),
      tags: { scenario: 'read' },
    },
  );

  check(response, {
    'consulta de saldo responde 200': (res) => res.status === 200,
  });
  sleep(Number(__ENV.K6_SLEEP || 1));
}

export function createTransfer(data) {
  const correlationId = `k6-transfer-${__VU}-${__ITER}`;
  const idempotencyKey = `${correlationId}-idempotency`;
  const response = http.post(
    `${BASE_URL}/api/transactions`,
    JSON.stringify({
      correlationId,
      sourceAccount: __ENV.K6_SOURCE_ACCOUNT,
      targetAccount: __ENV.K6_TARGET_ACCOUNT,
      amount: AMOUNT,
    }),
    {
      headers: headers(data, correlationId, idempotencyKey),
      tags: { scenario: 'create' },
    },
  );

  check(response, {
    'transferencia aceptada': (res) => [200, 201, 202].includes(res.status),
  });
  sleep(Number(__ENV.K6_SLEEP || 1));
}
