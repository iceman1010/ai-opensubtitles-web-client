# API Documentation Index

## Overview

The AI OpenSubtitles Web Client interfaces with the OpenSubtitles AI API to provide AI-powered transcription and translation services. All API functions are implemented in `src/services/api.ts` and exposed through the `APIContext` provider.

## Architecture

### Layered Architecture

```
Component Layer
    ↓
APIContext Provider (src/contexts/APIContext.tsx)
    ↓
OpenSubtitlesAPI Class (src/services/api.ts)
    ↓
networkUtils (retry, error handling)
    ↓
Fetch API → OpenSubtitles AI Server
```

### Key Components

1. **OpenSubtitlesAPI** (`src/services/api.ts`)
   - Core API client with all endpoint methods
   - Handles authentication, token management, request construction
   - 731 lines of implementation

2. **APIContext** (`src/contexts/APIContext.tsx`)
   - React context for global API state
   - Auth state management (isAuthenticated, isAuthenticating)
   - Wrapped API methods with auth-retry logic
   - Session expiration handling
   - Credit balance tracking

3. **Network Utilities** (`src/utils/networkUtils.ts`)
   - Automatic retry with exponential backoff
   - Error categorization and handling
   - Connectivity checks
   - Request/response logging

4. **Storage Service** (`src/services/storageService.ts`)
   - Token persistence (localStorage with 6-hour expiry)
   - Configuration management
   - Credential storage

5. **Cache Manager** (`src/services/cache.ts`)
   - In-memory caching for API responses
   - Automatic invalidation strategies
   - Reduces redundant API calls

## Authentication Flow

```
User Login
    ↓
POST /login (username, password, Api-Key)
    ↓
Server returns JWT token (6-hour validity)
    ↓
Token saved to localStorage
    ↓
All subsequent requests include:
  - Authorization: Bearer <token>
  - Api-Key: <api-key>
  - User-Agent: aios v1
```

### Key Features

- **No automatic login on page load** (prevents 429 rate limit bans)
- **Cached token validation** before fresh login attempt
- **Session expiration detection** (401/403 responses)
- **Reconnect flow** for stored credentials
- **Logout clears** tokens, cache, and state

## Base URLs

| Environment | Base URL |
|-------------|----------|
| Development | `/api/v1` (Vite proxy) |
| Production | `/ai-web/api/v1` (Nginx proxy) |

### URL Construction

- **AI Service**: `{baseURL}/ai{endpoint}` (e.g., `/ai/transcribe`)
- **Login**: `{baseURL}{endpoint}` (e.g., `/login`)
- **Proxy**: `{baseURL}/proxy{endpoint}` (e.g., `/proxy/subtitles`)
- **OpenSubtitles Direct**: `{baseURL}/infos{endpoint}`

## Request Headers

### Standard Headers

```typescript
{
  'Accept': 'application/json',
  'Api-Key': '<api-key>',
  'User-Agent': 'aios v1',
  'X-User-Agent': 'aios v1',
  'Content-Type': 'application/json', // when applicable
  'Authorization': 'Bearer <token>'  // when authenticated
}
```

## API Response Format

```typescript
interface APIResponse<T = any> {
  correlation_id?: string;  // For async task tracking
  status: 'CREATED' | 'PENDING' | 'COMPLETED' | 'ERROR' | 'TIMEOUT';
  data?: T;                 // Response payload
  errors?: string[];        // Error messages
}
```

## Documentation Structure

| File | Description |
|------|-------------|
| [authentication.md](./authentication.md) | Login, token management, session handling |
| [transcription.md](./transcription.md) | Transcription, language detection services |
| [translation.md](./translation.md) | Subtitle translation services |
| [subtitles.md](./subtitles.md) | Subtitle search, download, language lists |
| [media.md](./media.md) | Features, recent media, activities |
| [credits.md](./credits.md) | Credit balance, packages, pricing |
| [info.md](./info.md) | Service models, languages, AI configurations |
| [retry-error.md](./retry-error.md) | Retry logic, error handling, network errors |
| [caching.md](./caching.md) | Cache strategies, invalidation mechanisms |

## Quick Reference

### Available API Functions (50+ methods)

**Authentication (3)**
- `login()`
- `autoLogin()`
- `reconnect()`

**Transcription (7)**
- `getTranscriptionInfo()`
- `initiateTranscription()`
- `checkTranscriptionStatus()`
- `getTranscriptionLanguagesForApi()`
- `detectLanguage()`
- `checkLanguageDetectionStatus()`

**Translation (6)**
- `getTranslationInfo()`
- `initiateTranslation()`
- `checkTranslationStatus()`
- `getTranslationLanguagesForApi()`
- `getTranslationApisForLanguage()`

**Subtitles (6)**
- `searchSubtitles()`
- `downloadSubtitle()`
- `getSubtitleSearchLanguages()`
- `downloadFile()`
- `downloadFileByMediaId()`

**Media (3)**
- `searchForFeatures()`
- `getRecentMedia()`
- `getRecentActivities()`

**Credits (3)**
- `getCredits()`
- `getCreditPackages()`

**Info (3)**
- `getServicesInfo()`
- `getTranscriptionInfo()`
- `getTranslationInfo()`

### Common Patterns

1. **Async Operations**: Use correlation_id to poll status endpoints
2. **Cache Management**: Most GET methods cache responses
3. **Error Handling**: Standardized `{ success: false, error: string }` format
4. **Retry Logic**: 3 attempts with exponential backoff (except login)
5. **Auth Flow**: Token required for all AI service endpoints

## Statistics

- **Total API Methods**: 50+ wrapped methods
- **Core Endpoints**: ~30 distinct API endpoints
- **Type Definitions**: 40+ interfaces
- **Lines of Code**:
  - `api.ts`: 887 lines
  - `APIContext.tsx`: 533 lines
  - `networkUtils.ts`: 288 lines