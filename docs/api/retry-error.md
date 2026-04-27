# Retry Logic and Error Handling

Comprehensive guide to automatic retry mechanisms and error categorization.

## Overview

The API client implements sophisticated retry logic with exponential backoff and intelligent error categorization to handle network issues, rate limits, and server errors.

## Network Error Types

```typescript
enum NetworkErrorType {
  OFFLINE = 'offline',
  TIMEOUT = 'timeout',
  PROXY_ERROR = 'proxy_error',
  CLOUDFLARE_ERROR = 'cloudflare_error',
  SERVER_ERROR = 'server_error',
  AUTH_ERROR = 'auth_error',
  RATE_LIMIT = 'rate_limit',
  UNKNOWN = 'unknown'
}
```

### Error Categories

| Type | Description | Retryable |
|------|-------------|-----------|
| `OFFLINE` | Device has no network connection | ✅ Yes |
| `TIMEOUT` | Request exceeded timeout | ✅ Yes |
| `PROXY_ERROR` | Proxy/Vite proxy failure | ✅ Yes |
| `CLOUDFLARE_ERROR` | Cloudflare blocking/challenge | ✅ Yes |
| `SERVER_ERROR` | HTTP 5xx errors | ✅ Yes |
| `AUTH_ERROR` | HTTP 401/403 | ❌ No |
| `RATE_LIMIT` | HTTP 429 | ✅ Yes (with backoff) |
| `UNKNOWN` | Unclassified error | ❌ No |

## Error Detection

### Network Error Patterns

```typescript
const networkErrorPatterns = [
  'failed to fetch',      // Browser network error
  'network error',        // Generic network error
  'err_internet_disconnected',
  'err_network_changed',
  'err_connection_refused',
  'err_name_not_resolved',
  'err_connection_timed_out',
  'err_connection_reset'
];
```

### Status Code Mapping

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 0 | OFFLINE | Network unreachable |
| 401 | AUTH_ERROR | Unauthorized |
| 403 | AUTH_ERROR | Forbidden |
| 408 | TIMEOUT | Request timeout |
| 429 | RATE_LIMIT | Too many requests |
| 500-599 | SERVER_ERROR | Server errors |

### Keyword Detection

Errors are analyzed for specific keywords:

```typescript
const errorConfig = {
  rateLimitErrors: {
    keywords: ['rate limit', 'too many requests', '429'],
    statusCodes: [429]
  },
  cloudflareErrors: {
    keywords: ['cloudflare', 'cf-ray', 'challenge'],
    statusCodes: []
  },
  proxyErrors: {
    keywords: ['proxy', 'cors', 'cross-origin'],
    statusCodes: []
  }
};
```

## Retry Configuration

### Default Retry Behavior

```typescript
// src/utils/networkConfig.ts
const defaultConfig = {
  maxRetries: 3,                    // Number of retry attempts
  retryEnabled: true,                // Enable/disable retries
  timeoutMs: 10000,                  // Request timeout (10s)
  baseDelayMs: 1000,                 // Initial delay (1s)
  maxDelayMs: 30000,                 // Max delay (30s)
  jitter: true,                      // Add randomness to delays
  jitterFactor: 0.3                  // ±30% randomness
};
```

### Error-Specific Delays

| Error Type | Attempt 1 | Attempt 2 | Attempt 3 | Max Delay |
|------------|-----------|-----------|-----------|----------|
| Rate Limit | 60,000ms | 300,000ms | 900,000ms | 900s |
| Cloudflare | 5,000ms | 10,000ms | 20,000ms | 30s |
| Server Error | 1,000ms | 2,000ms | 4,000ms | 30s |
| Timeout | 1,000ms | 2,000ms | 4,000ms | 30s |
| Offline | 3,000ms | 6,000ms | 12,000ms | 30s |
| Auth Error | No retry | N/A | N/A | N/A |

### Delay Calculation

```typescript
function calculateRetryDelay(
  errorType: NetworkErrorType,
  attempt: number,
  baseDelay: number
): number {
  // Get config for error type
  const config = getConfigForErrorType(errorType);
  
  // Calculate exponential backoff
  let delay = baseDelay * Math.pow(2, attempt);
  
  // Apply error-specific multiplier
  delay *= config.delayMultiplier || 1;
  
  // Add jitter (±30%)
  if (config.jitter) {
    const jitter = delay * 0.3 * (Math.random() * 2 - 1);
    delay += jitter;
  }
  
  // Apply min/max bounds
  delay = Math.max(config.minDelay, delay);
  delay = Math.min(config.maxDelay, delay);
  
  return Math.round(delay);
}
```

## Core Functions

### categorizeNetworkError()

Categorizes any error into a `NetworkError` type.

```typescript
interface NetworkError {
  type: NetworkErrorType;
  message: string;
  originalError?: any;
  isRetryable: boolean;
}

function categorizeNetworkError(error: any): NetworkError {
  // Check status code first
  const status = error.status || 0;
  
  if (status === 401 || status === 403) {
    return createError('authErrors', error, false);
  }
  
  if (status === 429) {
    return createError('rateLimitErrors', error, true);
  }
  
  if (status >= 500) {
    return createError('serverErrors', error, true);
  }
  
  // Check for offline
  if (!navigator.onLine) {
    return createError('offlineErrors', error, true);
  }
  
  // Check error messages
  const errorMessage = error.message?.toLowerCase() || '';
  
  if (errorMessage.includes('failed to fetch')) {
    return createError('proxyErrors', error, true);
  }
  
  if (errorMessage.includes('timeout')) {
    return createError('timeoutErrors', error, true);
  }
  
  return createError('unknown', error, false);
}
```

### apiRequestWithRetry()

Main retry wrapper for API calls.

```typescript
async function apiRequestWithRetry<T>(
  requestFn: () => Promise<T>,
  context: string = 'API Request',
  maxRetries?: number
): Promise<T> {
  const requestId = generateRequestId();
  const effectiveMaxRetries = maxRetries ?? getDefaultMaxRetries();
  
  try {
    // Execute with retry logic
    return await retryWithBackoff(
      () => executeRequest(requestFn, context),
      effectiveMaxRetries
    );
  } catch (error: any) {
    // Enhance error with context
    const networkError = categorizeNetworkError(error);
    
    logger.error('API Request Failed', {
      context,
      type: networkError.type,
      retryable: networkError.isRetryable,
      originalError: error
    });
    
    // Throw enhanced error
    throw enhanceError(error, networkError);
  }
}
```

### retryWithBackoff()

Implements exponential backoff retry loop.

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number
): Promise<T> {
  let lastError: any;
  const baseDelay = 1000; // 1 second
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if retryable
      const networkError = categorizeNetworkError(error);
      if (!networkError.isRetryable) {
        throw error; // Don't retry auth errors, etc.
      }
      
      // Check if max attempts reached
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay
      const errorType = networkError.type;
      const delay = calculateRetryDelay(errorType, attempt, baseDelay);
      
      logger.info(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
      
      // Wait before retry
      await sleep(delay);
    }
  }
  
  throw lastError;
}
```

### executeRequest()

Wraps request with connectivity checks.

```typescript
async function executeRequest<T>(
  requestFn: () => Promise<T>,
  context: string
): Promise<T> {
  // Check connectivity
  if (!isFullyOnline()) {
    if (!isOnline()) {
      throw new Error('Device is offline');
    }
    throw new Error('API server unreachable');
  }
  
  try {
    const result = await requestFn();
    
    // Record success
    recordRequestSuccess();
    
    return result;
  } catch (error) {
    // Record failure
    recordRequestFailure(error);
    throw error;
  }
}
```

## Login Exception

### No Retry on Login

Login requests NEVER retry automatically:

```typescript
async function login(username: string, password: string) {
  // Single attempt only
  const response = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  // No retry, even on 429
  // Prevents rate limit hammering
  // User must manually retry
  
  return handleResponse(response);
}
```

**Rationale**:
- Prevents credential brute-forcing
- Reduces server load during outages
- Better UX: user controls retry timing
- Avoids account lockout triggers

### Manual Retry Pattern

```typescript
const handleLogin = async () => {
  setLoading(true);
  
  try {
    const result = await api.login(username, password);
    if (result.success) {
      // Proceed to app
    } else {
      // Show error, allow manual retry
      setError(result.error);
      setCanRetry(true);
    }
  } catch (error) {
    // Network error - offer retry
    setError('Network error. Click to retry.');
    setCanRetry(true);
  } finally {
    setLoading(false);
  }
};
```

## Auth Error Handling

### 401/403 Flow

```typescript
const withAuthRetry = async <T>(
  fn: () => Promise<T>
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const status = error.status || 0;
    
    if (status === 401 || status === 403) {
      // Session expired
      clearToken();
      
      if (hasStoredCredentials()) {
        // Show reconnect prompt
        showReconnectPrompt();
      } else {
        // Redirect to login
        redirectToLogin();
      }
    }
    
    throw error;
  }
};
```

## User-Friendly Messages

### Error Message Mapping

```typescript
function getUserFriendlyMessage(error: NetworkError): string {
  switch (error.type) {
    case NetworkErrorType.OFFLINE:
      return 'Device is offline. Check your connection.';
    
    case NetworkErrorType.TIMEOUT:
      return 'Request timed out. Try again.';
    
    case NetworkErrorType.RATE_LIMIT:
      return 'Too many requests. Please wait a moment.';
    
    case NetworkErrorType.CLOUDFLARE_ERROR:
      return 'Security check failed. Refresh and try again.';
    
    case NetworkErrorType.PROXY_ERROR:
      return 'Cannot reach server. Check network settings.';
    
    case NetworkErrorType.SERVER_ERROR:
      return 'Server error. Please try again later.';
    
    case NetworkErrorType.AUTH_ERROR:
      return 'Session expired. Please log in again.';
    
    default:
      return 'An unexpected error occurred.';
  }
}
```

## Real-World Scenarios

### Scenario 1: Temporary Network Loss

```
1. User submits transcription
2. Network drops (OFFLINE error)
3. System detects offline status
4. Shows: "Device is offline. Check connection."
5. User restores connection
6. Retry succeeds automatically
```

### Scenario 2: Rate Limit Hit

```
1. User triggers rapid requests
2. Server returns 429
3. Error categorized as RATE_LIMIT
4. Calculates 60s backoff
5. Shows: "Too many requests. Please wait."
6. After 60s, retry succeeds
```

### Scenario 3: Server Maintenance

```
1. API server returns 503
2. Categorized as SERVER_ERROR
3. Retry with backoff: 1s → 2s → 4s
4. After 3 failures, shows error
5. User can manually retry later
```

### Scenario 4: Expired Session

```
1. Request made with expired token
2. Server returns 401
3. Categorized as AUTH_ERROR
4. NO RETRY
5. Token cleared
6. Shows: "Session expired. Reconnect or login."
7. User clicks reconnect
8. Fresh login attempt
```

## Monitoring and Debugging

### Request Tracking

```typescript
interface RequestMetrics {
  id: string;
  context: string;
  startTime: number;
  endTime: number;
  attempts: number;
  success: boolean;
  errorType?: NetworkErrorType;
}

const metrics: RequestMetrics[] = [];

function recordRequest(metrics: RequestMetrics) {
  metrics.push(metrics);
  
  // Analyze patterns
  const highFailure = metrics.filter(m => !m.success);
  if (highFailure.length > 10) {
    alert('High error rate detected');
  }
}
```

### Error Aggregation

```typescript
function aggregateErrors() {
  const counts = {
    OFFLINE: 0,
    TIMEOUT: 0,
    SERVER_ERROR: 0,
    RATE_LIMIT: 0,
    AUTH_ERROR: 0
  };
  
  recentErrors.forEach(error => {
    counts[error.type]++;
  });
  
  return counts;
  // { OFFLINE: 5, TIMEOUT: 2, ... }
}
```

## Configuration Options

### Per-Call Configuration

```typescript
// Override defaults for specific call
const result = await apiRequestWithRetry(
  () => fetchData(),
  'Import Operation',
  5  // 5 retries instead of default 3
);
```

### Global Configuration

```typescript
// src/utils/networkConfig.ts
export const networkConfigManager = {
  getMaxRetries(): number { return 3; },
  isRetryEnabled(): boolean { return true; },
  getDelayForErrorType(type: string, attempt: number): number { ... },
  applyJitter(delay: number): number { ... }
};
```

## Best Practices

### 1. Use Appropriate Retries

```typescript
// ✅ Good - retries on network errors
const result = await apiRequestWithRetry(fetchData);

// ❌ Bad - don't retry on business logic errors
try {
  validateInput(data);
  const result = await fetchData();
} catch (error) {
  // Don't retry validation errors
}
```

### 2. Set Context for Debugging

```typescript
// ✅ Good - descriptive context
await apiRequestWithRetry(fn, 'Fetch user profile');

// ❌ Bad - vague context  
await apiRequestWithRetry(fn, 'Request');
```

### 3. Handle Non-Retryable Errors

```typescript
try {
  const result = await apiRequestWithRetry(fn);
} catch (error) {
  if (error.type === 'AUTH_ERROR') {
    // Don't retry - handle auth
    redirectToLogin();
  }
}
```

### 4. Monitor Retry Rates

```typescript
const highRetryRate = metrics
  .filter(m => m.attempts > 1)
  .length / metrics.length > 0.5;
  
if (highRetryRate) {
  alert('High retry rate - investigate');
}
```

### 5. User Feedback

```typescript
// Show retry status to users
const [retryCount, setRetryCount] = useState(0);

const fetchData = async () => {
  try {
    setRetryCount(0);
    await apiRequestWithRetry(
      fn,
      'Loading',
      3,
      (attempt) => setRetryCount(attempt)  // Callback on retry
    );
  } catch (error) {
    if (retryCount > 0) {
      showMessage(`Retrying... (${retryCount}/3)`);
    }
  }
};
```

## Testing Retry Logic

### Mock Network Errors

```typescript
describe('retryWithBackoff', () => {
  it('retries on network error', async () => {
    let attempts = 0;
    const mockFn = jest.fn(() => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Network error');
      }
      return 'success';
    });
    
    const result = await retryWithBackoff(mockFn, 5);
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });
  
  it('does not retry auth error', async () => {
    const mockFn = jest.fn(() => {
      throw { status: 401, type: 'AUTH_ERROR' };
    });
    
    await expect(retryWithBackoff(mockFn, 5))
      .rejects.toThrow();
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});
```

## Performance Impact

### Retry Overhead

| Scenario | Without Retry | With Retry (3 attempts) | Impact |
|----------|---------------|------------------------|--------|
| Success on 1st attempt | 200ms | 200ms | None |
| Success on 2nd attempt | 200ms | 1,200ms | +1s |
| Success on 3rd attempt | 200ms | 3,400ms | +3.2s |
| All attempts fail | 200ms | 7,600ms | +7.4s |

*Note: Includes exponential backoff delays*

### Mitigation Strategies

1. **Fast fail on auth errors** - No retry delay
2. **Aggressive retry on timeout** - Likely transient
3. **Conservative on rate limits** - Respect server backoff
4. **Circuit breaker** - Stop retrying if all failing

## Related Methods

- [Authentication](./authentication.md) - Session management
- [Error Handling](./retry-error.md) - This section
- [Network Utilities](./../utils/networkUtils.ts) - Retry implementation