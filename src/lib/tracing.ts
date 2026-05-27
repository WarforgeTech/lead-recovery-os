import { trace, SpanStatusCode, type Attributes } from "@opentelemetry/api";

const tracer = trace.getTracer("pipeline-recovery-os");

export async function traceAsync<T>(name: string, attributes: Attributes, fn: () => Promise<T>) {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      span.setAttributes(attributes);
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
