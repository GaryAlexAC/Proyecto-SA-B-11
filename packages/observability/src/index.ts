import {
  context,
  metrics,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  type Context,
  type Span,
} from '@opentelemetry/api';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { type ExecutionContext, type LoggerService, type NestInterceptor } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

const correlationStorage = new (class {
  private readonly storage = new AsyncLocalStorage<string | undefined>();

  run<T>(correlationId: string | undefined, callback: () => T) {
    return this.storage.run(correlationId, callback);
  }

  get() {
    return this.storage.getStore();
  }
})();

let sdk: NodeSDK | undefined;

export async function startObservability(serviceName: string) {
  if (sdk) return;

  const endpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318').replace(/\/$/, '');
  const metricsPort = Number(process.env.METRICS_PORT ?? 9464);
  const traceExporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });
  const metricReader = new PrometheusExporter({ port: metricsPort, endpoint: '/metrics' });

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: process.env.IMAGE_VERSION ?? 'dev',
      'deployment.environment': process.env.ENVIRONMENT ?? 'dev',
    }),
    traceExporter,
    metricReader,
    instrumentations: [new HttpInstrumentation()],
  });

  await sdk.start();
}

export async function shutdownObservability() {
  await sdk?.shutdown();
  sdk = undefined;
}

export class StructuredLogger implements LoggerService {
  constructor(private readonly serviceName: string) {}

  log(message: unknown, contextName?: string) {
    this.write('INFO', message, contextName);
  }

  error(message: unknown, traceValue?: string, contextName?: string) {
    this.write('ERROR', message, contextName, traceValue);
  }

  warn(message: unknown, contextName?: string) {
    this.write('WARNING', message, contextName);
  }

  debug(message: unknown, contextName?: string) {
    this.write('DEBUG', message, contextName);
  }

  verbose(message: unknown, contextName?: string) {
    this.write('DEBUG', message, contextName);
  }

  private write(level: string, message: unknown, contextName?: string, traceValue?: string) {
    const spanContext = trace.getActiveSpan()?.spanContext();
    const output = {
      timestamp: new Date().toISOString(),
      serviceName: this.serviceName,
      level,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      context: contextName,
      correlationId: correlationStorage.get() ?? null,
      traceId: spanContext?.traceId ?? null,
      spanId: spanContext?.spanId ?? null,
      environment: process.env.ENVIRONMENT ?? 'dev',
      version: process.env.IMAGE_VERSION ?? 'dev',
      error: traceValue,
    };
    process.stdout.write(`${JSON.stringify(output)}\n`);
  }
}

export function injectTraceContext<T extends Record<string, unknown>>(payload: T) {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier, {
    set(target: Record<string, string>, key: string, value: string) {
      target[key] = value;
    },
  });
  return carrier.traceparent
    ? { ...payload, traceparent: carrier.traceparent }
    : payload;
}

function extractTraceContext(payload: unknown): Context {
  const traceparent =
    payload && typeof payload === 'object' && 'traceparent' in payload
      ? String((payload as { traceparent?: unknown }).traceparent ?? '')
      : '';
  if (!traceparent) return context.active();
  const carrier: Record<string, string> = { traceparent };
  return propagation.extract(context.active(), carrier, {
    get(carrier: Record<string, string>, key: string) {
      return carrier[key];
    },
    keys(carrier: Record<string, string>) {
      return Object.keys(carrier);
    },
  });
}

export class BrokerTraceInterceptor implements NestInterceptor {
  constructor(private readonly serviceName: string) {}

  intercept(executionContext: ExecutionContext, next: { handle(): Observable<unknown> }) {
    const data = executionContext.switchToRpc().getData();
    const pattern = executionContext.getHandler().name || 'broker.message';
    const correlationId =
      data && typeof data === 'object' && 'correlationId' in data
        ? String((data as { correlationId?: unknown }).correlationId ?? '')
        : undefined;
    const parent = extractTraceContext(data);
    const metrics = createServiceMetrics(this.serviceName);
    const startedAt = Date.now();
    const occurredAt =
      data && typeof data === 'object' && 'occurredAt' in data
        ? Date.parse(String((data as { occurredAt?: unknown }).occurredAt ?? ''))
        : Number.NaN;
    metrics.requests.add(1, { operation: pattern });

    const recordDurations = (status: 'ok' | 'error') => {
      const finishedAt = Date.now();
      const processingDuration = Number.isFinite(occurredAt)
        ? Math.max(0, finishedAt - occurredAt)
        : finishedAt - startedAt;
      metrics.latency.record(finishedAt - startedAt, {
        operation: pattern,
        status,
      });
      metrics.eventProcessing.record(processingDuration, {
        operation: pattern,
        status,
      });
    };

    return new Observable<unknown>((subscriber) => {
      context.with(parent, () => {
        const span = trace.getTracer(this.serviceName).startSpan(`broker ${pattern}`, {
          kind: SpanKind.CONSUMER,
          attributes: {
            'messaging.system': 'rabbitmq',
            'messaging.operation.type': 'process',
            'messaging.destination.name': pattern,
            ...(correlationId ? { correlationId } : {}),
          },
        });
        const spanContext = trace.setSpan(context.active(), span);
        correlationStorage.run(correlationId, () => {
          context.with(spanContext, () => {
            next.handle().subscribe({
              next: (value) => subscriber.next(value),
              error: (error) => {
                span.recordException(error as Error);
                span.setStatus({ code: SpanStatusCode.ERROR });
                metrics.errors.add(1, { operation: pattern });
                recordDurations('error');
                span.end();
                subscriber.error(error);
              },
              complete: () => {
                span.setStatus({ code: SpanStatusCode.OK });
                recordDurations('ok');
                span.end();
                subscriber.complete();
              },
            });
          });
        });
      });
    });
  }
}

export class HttpTraceInterceptor implements NestInterceptor {
  intercept(executionContext: ExecutionContext, next: { handle(): Observable<unknown> }) {
    const response = executionContext.switchToHttp().getResponse<{
      setHeader(name: string, value: string): void;
    }>();
    return next.handle().pipe(
      tap(() => {
        const spanContext = getTraceContext();
        if (spanContext?.traceId) {
          response.setHeader('X-Trace-Id', spanContext.traceId);
        }
      }),
    );
  }
}

export class HttpMetricsInterceptor implements NestInterceptor {
  private readonly metrics = createServiceMetrics('api-gateway');

  intercept(executionContext: ExecutionContext, next: { handle(): Observable<unknown> }) {
    const request = executionContext
      .switchToHttp()
      .getRequest<{ method?: string; route?: { path?: string } }>();
    const response = executionContext
      .switchToHttp()
      .getResponse<{ statusCode?: number }>();
    const operation = `${request.method ?? 'HTTP'} ${request.route?.path ?? 'unknown'}`;
    const startedAt = Date.now();
    return next.handle().pipe(
      tap(() => {
        this.metrics.requests.add(1, {
          operation,
          status: String(response.statusCode ?? 200),
        });
        this.metrics.latency.record(Date.now() - startedAt, {
          operation,
          status: 'ok',
        });
      }),
      catchError((error: unknown) => {
        this.metrics.requests.add(1, {
          operation,
          status: String(response.statusCode ?? 500),
        });
        this.metrics.errors.add(1, { operation });
        this.metrics.latency.record(Date.now() - startedAt, {
          operation,
          status: 'error',
        });
        throw error;
      }),
    );
  }
}

export function runWithSpan<T>(
  serviceName: string,
  name: string,
  correlationId: string | undefined,
  callback: (span: Span) => Promise<T> | T,
) {
  const tracer = trace.getTracer(serviceName);
  const span = tracer.startSpan(name, {
    attributes: correlationId ? { correlationId } : undefined,
  });
  return context.with(trace.setSpan(context.active(), span), () =>
    correlationStorage.run(correlationId, async () => {
      try {
        const result = await callback(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    }),
  );
}

export function getCorrelationId() {
  return correlationStorage.get();
}

export function createServiceMetrics(serviceName: string) {
  const meter = getMeter(serviceName);
  return {
    requests: meter.createCounter('bank_requests_total', {
      description: 'Total de operaciones procesadas',
    }),
    errors: meter.createCounter('bank_errors_total', {
      description: 'Total de operaciones fallidas',
    }),
    latency: meter.createHistogram('bank_operation_duration_ms', {
      description: 'Duración de operaciones en milisegundos',
      unit: 'ms',
    }),
    eventProcessing: meter.createHistogram('bank_event_processing_duration_ms', {
      description: 'Tiempo desde occurredAt hasta el procesamiento del evento',
      unit: 'ms',
    }),
  };
}

export function createEventDeliveryMetrics(serviceName: string) {
  const meter = getMeter(serviceName);
  return {
    published: meter.createCounter('bank_events_published_total', {
      description: 'Eventos publicados correctamente desde el outbox',
    }),
    dlq: meter.createCounter('bank_events_dlq_total', {
      description: 'Eventos agotados después de todos los reintentos del outbox',
    }),
  };
}

export function createNotificationMetrics(serviceName: string) {
  const meter = getMeter(serviceName);
  return {
    total: meter.createCounter('bank_notifications_total', {
      description: 'Notificaciones procesadas por el servicio',
    }),
    duration: meter.createHistogram('bank_notification_processing_duration_ms', {
      description: 'Duración del procesamiento de una notificación',
      unit: 'ms',
    }),
  };
}

export function getMeter(serviceName: string) {
  return metrics.getMeter(serviceName);
}

export function getTraceContext() {
  return trace.getActiveSpan()?.spanContext();
}
