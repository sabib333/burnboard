/**
 * BURN BOARD — Structured Logger
 * 
 * Lightweight structured logging for observability.
 * Separates user-facing errors from internal diagnostics.
 * 
 * Levels: debug, info, warn, error
 * 
 * Privacy:
 * - Never logs passwords or auth secrets
 * - Never logs private content unnecessarily
 * - Sanitizes sensitive fields
 */

// ── Log Levels ───────────────────────────────────────────────
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

// ── Sensitive Field Patterns ─────────────────────────────────
const SENSITIVE_FIELDS = [
  'password', 'secret', 'token', 'authorization',
  'cookie', 'session', 'api_key', 'apikey',
  'access_token', 'refresh_token',
];

// ── Sanitize ─────────────────────────────────────────────────
function sanitize(data) {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = { ...data };
  
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

// ── Format ───────────────────────────────────────────────────
function formatMessage(level, component, message, data) {
  const timestamp = new Date().toISOString();
  const base = {
    timestamp,
    level,
    component,
    message,
  };
  
  if (data && Object.keys(data).length > 0) {
    base.data = sanitize(data);
  }
  
  return base;
}

// ── Logger Instance ──────────────────────────────────────────
function createLogger(component) {
  return {
    debug(message, data) {
      if (currentLevel > LOG_LEVELS.debug) return;
      const formatted = formatMessage('debug', component, message, data);
      console.debug(JSON.stringify(formatted));
    },
    
    info(message, data) {
      if (currentLevel > LOG_LEVELS.info) return;
      const formatted = formatMessage('info', component, message, data);
      console.log(JSON.stringify(formatted));
    },
    
    warn(message, data) {
      if (currentLevel > LOG_LEVELS.warn) return;
      const formatted = formatMessage('warn', component, message, data);
      console.warn(JSON.stringify(formatted));
    },
    
    error(message, data) {
      if (currentLevel > LOG_LEVELS.error) return;
      const formatted = formatMessage('error', component, message, data);
      console.error(JSON.stringify(formatted));
    },
    
    // Convenience: log request timing
    timing(operation, durationMs, data = {}) {
      const level = durationMs > 3000 ? 'error' : 
                    durationMs > 1000 ? 'warn' : 'info';
      
      this[level](`${operation} completed`, {
        durationMs,
        ...data,
      });
    },
    
    // Convenience: log API request
    request(method, path, statusCode, durationMs, data = {}) {
      const level = statusCode >= 500 ? 'error' :
                    statusCode >= 400 ? 'warn' : 'info';
      
      this[level](`${method} ${path}`, {
        statusCode,
        durationMs,
        ...data,
      });
    },
  };
}

// ── Performance Timer ────────────────────────────────────────

/**
 * Create a timer for measuring operation duration.
 * Usage:
 *   const timer = createTimer('hot-seat-fetch');
 *   // ... do work ...
 *   timer.end({ hotSeatId: id });
 */
export function createTimer(operation, logger) {
  const start = Date.now();
  const log = logger || createLogger('perf');
  
  return {
    end(data = {}) {
      const durationMs = Date.now() - start;
      log.timing(operation, durationMs, data);
      return durationMs;
    },
  };
}

// ── Request Timer Middleware ──────────────────────────────────

/**
 * Wrap an API handler with request timing.
 */
export function withTiming(handler, componentName) {
  const log = createLogger(componentName || 'api');
  
  return async (request, context) => {
    const start = Date.now();
    const method = request.method || 'GET';
    const url = request.url || 'unknown';
    
    try {
      const response = await handler(request, context);
      const durationMs = Date.now() - start;
      
      log.request(method, url, response.status || 200, durationMs);
      
      return response;
    } catch (error) {
      const durationMs = Date.now() - start;
      log.error('Unhandled API error', {
        method,
        url,
        durationMs,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
      throw error;
    }
  };
}

// ── Export ───────────────────────────────────────────────────

export default createLogger;
export { createLogger };
