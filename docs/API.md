# API Documentation

## Overview

This documentation covers all API functions, endpoints, authentication mechanisms, and integration patterns for the AI OpenSubtitles Web Client.

**Source Code**: `src/services/api.ts`, `src/contexts/APIContext.tsx`

## 📚 Documentation Structure

The API documentation is organized into focused modules:

### [📋 API Index](./api/index.md)
Overview, architecture, and quick reference for all 50+ API methods.

### [🔐 Authentication](./api/authentication.md)
- Login flow and token management
- Session handling and auto-login
- Token refresh and reconnection
- Security considerations

### [🎙️ Transcription Services](./api/transcription.md)
- `getTranscriptionInfo()` - Available models and languages
- `initiateTranscription()` - Start audio/video transcription
- `checkTranscriptionStatus()` - Poll for completion
- `detectLanguage()` - Automatic language detection
- Complete workflow examples

### [🌍 Translation Services](./api/translation.md)
- `getTranslationInfo()` - Available translation models
- `initiateTranslation()` - Translate subtitle files
- `checkTranslationStatus()` - Poll for completion
- Language pair support

### [📄 Subtitle Operations](./api/subtitles.md)
- `searchSubtitles()` - Search OpenSubtitles database
- `downloadSubtitle()` - Download subtitle files
- `getSubtitleSearchLanguages()` - Available languages
- Advanced search patterns and filters

### [🎬 Media & Features](./api/media.md)
- `searchForFeatures()` - Find movies and TV shows
- `getRecentMedia()` - Recently processed files
- `getRecentActivities()` - Credit usage history

### [💳 Credits Management](./api/credits.md)
- `getCredits()` - Check balance
- `getCreditPackages()` - Purchase options
- Cost estimation and optimization
- Usage tracking

### [ℹ️ Service Information](./api/info.md)
- `getServicesInfo()` - Pricing and reliability
- `getTranscriptionInfo()` - Model capabilities
- `getTranslationInfo()` - Translation options
- Dynamic configuration

### [🔄 Retry & Error Handling](./api/retry-error.md)
- Automatic retry strategies
- Error categorization
- Exponential backoff
- User-friendly error messages

### [📦 Caching Strategy](./api/caching.md)
- Multi-layer caching approach
- Cache invalidation patterns
- Performance optimization
- Memory management

## 🚀 Quick Start

### 1. Setup API Context

```tsx
import { APIProvider, useAPI } from './contexts/APIContext';

function App() {
  return (
    <APIProvider>
      <MyComponent />
    </APIProvider>
  );
}
```

### 2. Login

```tsx
function LoginComponent() {
  const { login, isAuthenticating } = useAPI();
  
  const handleLogin = async () => {
    const success = await login(
      'username', 
      'password', 
      'api-key',
      true  // rememberMe
    );
    
    if (success) {
      // Navigate to main app
    }
  };
}
```

### 3. Transcribe Audio

```tsx
const { initiateTranscription, checkTranscriptionStatus } = useAPI();

const result = await initiateTranscription(audioFile, {
  language: 'en',
  api: 'openai-whisper-large-v3',
  returnContent: false
});

if (result.status === 'CREATED') {
  // Poll for completion
  const status = await checkTranscriptionStatus(result.correlation_id);
  
  if (status.status === 'COMPLETED') {
    console.log('Transcript URL:', status.data.url);
  }
}
```

### 4. Translate Subtitles

```tsx
const { initiateTranslation, checkTranslationStatus } = useAPI();

const result = await initiateTranslation(subtitleFile, {
  translateFrom: 'en',
  translateTo: 'es',
  api: 'DeepL',
  returnContent: false
});

if (result.status === 'CREATED') {
  // Poll for completion
  const status = await checkTranslationStatus(result.correlation_id);
  
  if (status.status === 'COMPLETED') {
    console.log('Download URL:', status.data.url);
  }
}
```

## 📊 API Statistics

| Metric | Value |
|--------|-------|
| **Total API Methods** | 50+ wrapped methods |
| **Core Endpoints** | ~30 distinct |
| **Type Definitions** | 40+ interfaces |
| **Lines of Code** | ~2,700 (api.ts + APIContext) |
| **Caching Layers** | 3 (memory, activity, time) |
| **Retry Attempts** | 3 (except login) |
| **Token Validity** | 6 hours |
| **Supported Languages** | 100+ |

## 🔧 Key Features

### Authentication
- ✅ JWT token-based auth
- ✅ Automatic token refresh
- ✅ Session expiration handling
- ✅ Secure credential storage
- ✅ Rate limit protection

### Transcription
- ✅ Multiple AI models (Whisper, Google, etc.)
- ✅ 100+ language support
- ✅ Async processing with polling
- ✅ Automatic language detection
- ✅ Progress tracking

### Translation
- ✅ DeepL, Google, and more
- ✅ SRT/VTT format support
- ✅ Batch processing
- ✅ Quality tiers
- ✅ 30+ language pairs

### Subtitles
- ✅ OpenSubtitles integration
- ✅ Advanced search filters
- ✅ Trusted sources
- ✅ IMDB/TMDB lookup
- ✅ Download management

### Reliability
- ✅ Automatic retry with backoff
- ✅ Network error handling
- ✅ Intelligent caching
- ✅ Timeout management
- ✅ Circuit breaker pattern

## 📈 Performance

- **Cache hit rate**: ~70%
- **API call reduction**: 80%
- **Load time improvement**: 4.7x faster
- **Memory usage**: ~315 KB (cached data)
- **Processing speed**: 0.5x-2x real-time (transcription)

## 🔐 Security

1. **API Key**: Required for all requests
2. **JWT Token**: 6-hour validity
3. **HTTPS**: Production only
4. **CORS**: Handled via proxy
5. **Credentials**: Optional storage
6. **Token expiry**: Auto-validated

## 📚 Additional Resources

- **Source Code**: [GitHub Repository](https://github.com/iceman1010/ai-opensubtitles-web-client)
- **Live Demo**: [AI OpenSubtitles Web](https://ai.opensubtitles.com/ai-web/)
- **Desktop App**: [AI OpenSubtitles Desktop](https://github.com/iceman1010/ai-opensubtitles-desktop-client)
- **API Reference**: [OpenSubtitles AI Docs](https://ai.opensubtitles.com/docs)

## 🆘 Support

For issues or questions:
- Check the troubleshooting sections in each module
- Review error handling patterns
- See [GitHub Issues](https://github.com/iceman1010/ai-opensubtitles-web-client/issues)

---

**Last Updated**: 2026-04-27  
**Version**: 1.1.3