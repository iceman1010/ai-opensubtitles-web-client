# Service Information

Retrieve metadata about available AI services, languages, and models.

## Overview

These endpoints provide dynamic configuration data about what transcription/translation services, languages, and pricing are available.

## Methods

### getServicesInfo()

Retrieves detailed information about available service models (pricing, reliability, supported languages).

**Endpoint**: `GET /ai/info/services`

**Request Headers**:
```typescript
{
  'Api-Key': string,
  'Authorization': 'Bearer {token}'
}
```

**Implementation**:
```typescript
async getServicesInfo(): Promise<{
  success: boolean;
  data?: ServicesInfo;
  error?: string;
}>
```

**ServicesInfo Interface**:
```typescript
interface ServicesInfo {
  Translation: ServiceModel[];
  Transcription: ServiceModel[];
}

interface ServiceModel {
  name: string;                    // Internal name
  display_name: string;            // User-facing name
  description: string;             // Service description
  pricing: string;                 // Pricing info (e.g., "$0.01/min")
  reliability: string;             // Reliability rating
  price: number;                   // Price per character/unit
  languages_supported: LanguageInfo[];
}

interface LanguageInfo {
  language_code: string;   // ISO code
  language_name: string;   // Display name
}
```

**Success Response**:
```typescript
{
  success: true,
  data: {
    Translation: [
      {
        name: "DeepL",
        display_name: "DeepL Pro",
        description: "Neural machine translation",
        pricing: "$0.00002/character",
        reliability: "99.5%",
        price: 0.00002,
        languages_supported: [
          { language_code: "en", language_name: "English" },
          { language_code: "es", language_name: "Spanish" },
          { language_code: "fr", language_name: "French" },
          // ... more languages
        ]
      },
      {
        name: "Google",
        display_name: "Google Translate",
        description: "Google's translation service",
        pricing: "$0.000015/character",
        reliability: "98.8%",
        price: 0.000015,
        languages_supported: [
          // 100+ languages
        ]
      }
    ],
    Transcription: [
      {
        name: "openai-whisper-large-v3",
        display_name: "OpenAI Whisper Large v3",
        description: "High accuracy multilingual speech recognition",
        pricing: "$0.0001/character",
        reliability: "97.2%",
        price: 0.0001,
        languages_supported: [
          { language_code: "en", language_name: "English" },
          { language_code: "es", language_name: "Spanish" },
          // ... 90+ languages
        ]
      },
      {
        name: "openai-whisper-base",
        display_name: "OpenAI Whisper Base",
        description: "Fast, lightweight model",
        pricing: "$0.00006/character",
        reliability: "94.5%",
        price: 0.00006,
        languages_supported: [
          // Fewer languages
        ]
      }
      // ... more models
    ]
  }
}
```

**Error Response**:
```typescript
{
  success: false,
  error: "API Key is required"
}
```

**Caching**: Service info is cached
- Cache key: `services_info`
- Invalidation: Manual via `refreshModelInfo()`

**Retry Logic**: 3 attempts

**Usage**:
```typescript
const { getServicesInfo } = useAPI();

const loadServiceInfo = async () => {
  const result = await getServicesInfo();
  if (result.success) {
    const { Translation, Transcription } = result.data;
    
    // Populate UI with model info
    setTranslationModels(Translation);
    setTranscriptionModels(Transcription);
  }
};

// Display pricing
Transcription.map(model => (
  <div key={model.name}>
    <h3>{model.display_name}</h3>
    <p>{model.description}</p>
    <p>Price: {model.pricing}</p>
    <p>Reliability: {model.reliability}</p>
    <p>Languages: {model.languages_supported.length}</p>
  </div>
));
```

**Best Practices**:
- Cache the response (changes infrequently)
- Use for building "Info" or "About" pages
- Reference `price` for cost calculations
- Show `reliability` to help users choose

---

### getTranscriptionInfo()

Retrieves available transcription models and languages.

**Endpoint**: 
- `POST /ai/info/transcription_apis`
- `POST /ai/info/transcription_languages`

**These are called in parallel**

**Request Headers**:
```typescript
{
  'Api-Key': string,
  'Authorization': 'Bearer {token}',
  'Content-Type': 'application/json'
}
```

**Request Body**: `{}` (empty object)

**Implementation**:
```typescript
async getTranscriptionInfo(): Promise<{
  success: boolean;
  data?: TranscriptionInfo;
  error?: string;
}>

interface TranscriptionInfo {
  apis: { [apiName: string]: any };  // Model metadata
  languages: {                       // Languages per model
    [apiName: string]: LanguageInfo[]
  } | LanguageInfo[];                 // OR flat list
}
```

**Success Response**:
```typescript
{
  success: true,
  data: {
    apis: {
      'openai-whisper-large-v3': {
        max_duration: 1800,    // 30 minutes
        supported_formats: ['mp3', 'wav', 'm4a', 'mp4'],
        languages: ['en', 'es', 'fr', ...],
        description: 'High accuracy model',
        is_default: false
      },
      'openai-whisper-tiny': {
        max_duration: 600,     // 10 minutes
        supported_formats: ['mp3', 'wav'],
        languages: ['en', 'es'],
        description: 'Fast, compact model',
        is_default: true
      }
      // ... more models
    },
    languages: {
      'openai-whisper-large-v3': [
        { language_code: 'en', language_name: 'English' },
        { language_code: 'es', language_name: 'Spanish' }
      ],
      'openai-whisper-tiny': [
        // Fewer languages for smaller model
      ]
    }
  }
}
```

**Error Response**:
```typescript
{
  success: false,
  error: "API Key is required"
}
```

**Caching**: In-memory cache
- Cache key: `transcription_info`
- Invalidation: Manual via `refreshModelInfo()`

**Retry Logic**: 3 attempts (with retries for each parallel call)

**Usage**:
```typescript
const { getTranscriptionInfo } = useAPI();

const loadTranscriptionOptions = async () => {
  const result = await getTranscriptionInfo();
  if (result.success) {
    const { apis, languages } = result.data;
    
    // Get default model
    const defaultModel = Object.values(apis)
      .find(api => api.is_default);
    
    // Populate model selector
    setModelOptions(Object.entries(apis).map(([key, api]) => ({
      value: key,
      label: api.description,
      maxDuration: api.max_duration
    })));
    
    // Store languages for model lookup
    setModelLanguages(languages);
  }
};

// Get languages for selected model
const getLanguagesForModel = (modelName: string) => {
  return modelLanguages[modelName] || [];
};
```

**Key Use Cases**:
1. Building model selector dropdown
2. Validating model capabilities
3. Getting language options per model
4. Enforcing duration limits

---

### getTranslationInfo()

Retrieves available translation models and supported language pairs.

**Endpoint**:
- `POST /ai/info/translation_apis`
- `POST /ai/info/translation_languages`

**These are called in parallel**

**Request Headers**:
```typescript
{
  'Api-Key': string,
  'Authorization': 'Bearer {token}',
  'Content-Type': 'application/json'
}
```

**Request Body**: `{}` (empty object)

**Implementation**:
```typescript
async getTranslationInfo(): Promise<{
  success: boolean;
  data?: TranslationInfo;
  error?: string;
}>

interface TranslationInfo {
  apis: { [apiName: string]: any };
  languages: { [apiName: string]: LanguageInfo[] };
}
```

**Success Response**:
```typescript
{
  success: true,
  data: {
    apis: {
      'DeepL': {
        display_name: 'DeepL',
        description: 'High-quality neural translation',
        max_characters: 500000,  // Per request
        supported_formats: ['srt', 'vtt', 'txt'],
        languages: ['en', 'es', 'fr', 'de', 'it', ...],
        quality_tiers: ['standard', 'premium']
      },
      'Google': {
        display_name: 'Google Translate',
        description: 'Broad language coverage',
        max_characters: 100000,  // Lower limit
        supported_formats: ['srt', 'vtt', 'txt'],
        languages: ['en', 'es', 'fr', 'de', 'it', ...],
        // ... 100+ languages
      }
    },
    languages: {
      'DeepL': [
        { language_code: 'en', language_name: 'English' },
        { language_code: 'es', language_name: 'Spanish' },
        { language_code: 'fr', language_name: 'French' }
      ],
      'Google': [
        // All 100+ languages
      ]
    }
  }
}
```

**Error Response**:
```typescript
{
  success: false,
  error: "API Key is required"
}
```

**Caching**: In-memory cache
- Cache key: `translation_info`
- Invalidation: Manual via `refreshModelInfo()`

**Retry Logic**: 3 attempts

**Usage**:
```typescript
const { getTranslationInfo } = useAPI();

const loadTranslationOptions = async () => {
  const result = await getTranslationInfo();
  if (result.success) {
    const { apis, languages } = result.data;
    
    // Filter models by language pair support
    const getModelsForLanguagePair = (
      source: string, 
      target: string
    ) => {
      return Object.entries(apis).filter(([name, api]) => {
        const langs = languages[name] || [];
        return langs.some(l => l.language_code === source) &&
               langs.some(l => l.language_code === target);
      });
    };
    
    const models = getModelsForLanguagePair('en', 'es');
    // Returns DeepL, Google, etc.
  }
};
```

**Model Comparison**:

| Feature | DeepL | Google |
|---------|-------|--------|
| Max Characters | 500K | 100K |
| Languages | 30+ | 100+ |
| Quality | Higher | Good |
| Speed | Slower | Faster |
| Cost | Higher | Lower |
| Formats | SRT, VTT, TXT | SRT, VTT, TXT |

---

## Common Patterns

### Load All Service Information

```typescript
const loadAllInfo = async () => {
  const [services, transcription, translation] = await Promise.all([
    getServicesInfo(),
    getTranscriptionInfo(),
    getTranslationInfo()
  ]);
  
  return {
    services: services.data,
    transcription: transcription.data,
    translation: translation.data
  };
};
```

### Refresh All Cached Info

```typescript
// Available in APIContext as refreshModelInfo()
const { refreshModelInfo } = useAPI();

// Clear and reload all cached info
const handleRefresh = () => {
  refreshModelInfo();
};
```

### Validate Model Support

```typescript
const isModelSupported = (
  modelName: string,
  language: string,
  info: TranscriptionInfo
): boolean => {
  const modelLangs = info.languages[modelName];
  return modelLangs?.some(l => l.language_code === language) || false;
};
```

### Build Language-Model Matrix

```typescript
const buildLanguageMatrix = (info: TranslationInfo) => {
  const matrix: { [lang: string]: string[] } = {};
  
  Object.entries(info.languages).forEach(([model, langs]) => {
    langs.forEach(lang => {
      if (!matrix[lang.language_code]) {
        matrix[lang.language_code] = [];
      }
      matrix[lang.language_code].push(model);
    });
  });
  
  return matrix;
};

// Result: { 'en': ['DeepL', 'Google'], 'es': ['DeepL'], ... }
```

## Cache Management

### Clear Specific Cache

```typescript
import CacheManager from './services/cache';

// Clear transcription info
CacheManager.remove('transcription_info');

// Clear translation info  
CacheManager.remove('translation_info');

// Clear services info
CacheManager.remove('services_info');
```

### Clear All Info Caches

```typescript
// Available in APIContext as refreshModelInfo()
refreshModelInfo();

// Or manually:
CacheManager.remove('transcription_info');
CacheManager.remove('translation_info');
CacheManager.remove('services_info');
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `API Key is required` | No API key configured | Set API key in config | 
| `401 Unauthorized` | Invalid token | Re-authenticate |
| `403 Forbidden` | No permission | Check API key permissions |
| `404 Not Found` | Endpoint deprecated | Update client library |
| `500 Server Error` | API service issue | Retry after delay |

## Best Practices

1. **Cache aggressively**
   - Service info changes rarely
   - Cache for hours or days
   - Invalidate on user action

2. **Validate before use**
   ```typescript
   // Check if language is supported
   const supported = isModelSupported(model, language, info);
   if (!supported) {
     showError('Language not supported');
   }
   ```

3. **Handle missing data gracefully**
   ```typescript
   const languages = info.languages[model] || [];
   if (languages.length === 0) {
     // Fallback to default
   }
   ```

4. **Use for dynamic UI**
   ```typescript
   // Build dropdowns dynamically
   <select>
     {apis.map(api => (
       <option value={api}>{api}</option>
     ))}
   </select>
   ```

5. **Monitor for changes**
   ```typescript
   // Periodically refresh
   setInterval(refreshModelInfo, 3600000); // 1 hour
   ```

## Response Field Reference

### Service Model Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Internal identifier |
| `display_name` | string | User-friendly name |
| `description` | string | Service description |
| `pricing` | string | Human-readable pricing |
| `reliability` | string | Uptime percentage |
| `price` | number | Cost per unit |
| `languages_supported` | LanguageInfo[] | Available languages |

### Transcription API Fields

| Field | Type | Description |
|-------|------|-------------|
| `max_duration` | number | Max audio duration (seconds) |
| `supported_formats` | string[] | Audio formats |
| `languages` | string[] | Language codes |
| `description` | string | Model description |
| `is_default` | boolean | Default model flag |

### Translation API Fields

| Field | Type | Description |
|-------|------|-------------|
| `max_characters` | number | Max characters per request |
| `supported_formats` | string[] | Subtitle formats |
| `languages` | string[] | Language codes |
| `quality_tiers` | string[] | Quality levels |

## Related Methods

- [Transcription Services](./transcription.md) - Use transcription models
- [Translation Services](./translation.md) - Use translation models
- [Service Information](./info.md) - Pricing and reliability info