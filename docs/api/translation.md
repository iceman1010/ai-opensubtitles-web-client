# Translation Services

Translates subtitle files between 100+ languages using AI models like DeepL.

## Overview

Translation converts existing subtitle files (SRT/VTT) from one language to another.

## Key Types

```typescript
interface TranslationOptions {
  translateFrom: string;  // Source language code (e.g., "en")
  translateTo: string;    // Target language code (e.g., "es")
  api: string;            // Translation model (e.g., "DeepL")
  returnContent?: boolean;  // Include translated content in response
}

interface APIResponse<T = any> {
  correlation_id?: string;
  status: 'CREATED' | 'PENDING' | 'COMPLETED' | 'ERROR' | 'TIMEOUT';
  data?: T;
  errors?: string[];
}
```

## Methods

### getTranslationInfo()

Retrieves available translation models and supported language pairs.

**Endpoint**: `POST /ai/info/translation_apis` and `/ai/info/translation_languages`

**Request Headers**:
```typescript
{
  'Api-Key': string,
  'Authorization': 'Bearer {token}',
  'Content-Type': 'application/json'
}
```

**Request Body**: `{}` (empty object)

**Response**:
```typescript
{
  success: true,
  data: {
    apis: {
      'DeepL': {
        display_name: 'DeepL',
        description: 'Neural machine translation',
        languages: ['en', 'es', 'fr', ...]
      },
      'Google': {
        display_name: 'Google Translate',
        ...
      }
    },
    languages: {
      'DeepL': [
        { language_code: 'en', language_name: 'English' },
        { language_code: 'es', language_name: 'Spanish' }
      ]
    }
  }
}
```

**Caching**: Result cached in memory

**Usage**:
```typescript
const { getTranslationInfo } = useAPI();

const loadTranslationModels = async () => {
  const result = await getTranslationInfo();
  if (result.success) {
    const models = result.data.apis;      // Available models
    const languages = result.data.languages; // Languages per model
  }
};
```

**Supported Language Pairs**: Varies by model
- DeepL: 30+ languages, strong European language support
- Google: 100+ languages, broad coverage

---

### initiateTranslation()

Starts asynchronous subtitle translation.

**Endpoint**: `POST /ai/translate`

**Parameters**:
- `subtitleFile`: `File | Blob` - SRT or VTT subtitle file
- `options`: `TranslationOptions` - Source, target, and model

**Request Headers**:
```typescript
{
  'Api-Key': string,
  'Authorization': 'Bearer {token}'
}
```

**Request Body**: `FormData` with fields:
- `file`: Subtitle file (SRT/VTT)
- `translate_from`: Source language code (e.g., "en")
- `translate_to`: Target language code (e.g., "es")
- `api`: Model name (e.g., "DeepL")
- `return_content`: "true" (optional)

**Implementation**:
```typescript
async initiateTranslation(
  subtitleFile: File | Blob,
  options: TranslationOptions
): Promise<APIResponse>
```

**Success Response** (202 Created):
```typescript
{
  status: 'CREATED',
  correlation_id: 'trans-abc-123',
  data: null
}
```

**Error Response**:
```typescript
{
  status: 'ERROR',
  errors: ['Unsupported language pair: en->xx']
}
```

**Automatic Cache Invalidation**:
```typescript
CacheManager.removeByPrefix('recent_media');
CacheManager.removeByPrefix('recent_activities');
```

**Retry Logic**: 3 attempts on network errors

**Usage**:
```typescript
const { initiateTranslation } = useAPI();

const handleTranslate = async (subtitleFile) => {
  const result = await initiateTranslation(subtitleFile, {
    translateFrom: 'en',
    translateTo: 'es',
    api: 'DeepL',
    returnContent: false
  });

  if (result.status === 'CREATED') {
    const correlationId = result.correlation_id;
    pollTranslationStatus(correlationId);
  }
};
```

**Best Practices**:
- Ensure subtitle file is properly formatted
- Verify language pair is supported by chosen model
- Large files take longer to process

---

### checkTranslationStatus()

Polls for translation task completion.

**Endpoint**: `POST /ai/translation/{correlationId}`

**Parameters**:
- `correlationId`: `string` - From `initiateTranslation()` response

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
async checkTranslationStatus(
  correlationId: string
): Promise<APIResponse<CompletedTaskData>>
```

**Response - PENDING**:
```typescript
{
  status: 'PENDING',
  data: null
}
```

**Response - COMPLETED**:
```typescript
{
  status: 'COMPLETED',
  data: {
    file_name: 'translated_es.srt',
    url: 'https://api.ai.com/files/xyz/def.srt',
    character_count: 15420,
    unit_price: 0.00015,  // Translation typically costs more
    total_price: 2.31,
    credits_left: 982.69,
    task: {
      login: 'user@example.com',
      loginid: '12345',
      id: 'task-abc',
      api: 'DeepL',
      language: 'es',           // Target language
      translation: 'en',         // Source language
      start_time: 1640995200
    }
  }
}
```

**Response - ERROR**:
```typescript
{
  status: 'ERROR',
  errors: ['Unsupported format', 'Language pair not available']
}
```

**Typical Processing Times**:

| Subtitle Size | Model | Estimated Time |
|---------------|-------|----------------|
| 100 lines | DeepL | ~30-60 seconds |
| 500 lines | DeepL | ~2-5 minutes |
| 1000+ lines | DeepL | ~5-15 minutes |

*Generally faster than transcription*

**Polling Example**:
```typescript
const pollTranslationStatus = async (correlationId: string) => {
  const maxAttempts = 60;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const result = await checkTranslationStatus(correlationId);
    
    if (result.status === 'COMPLETED') {
      const translation = result.data;
      console.log('Download URL:', translation.url);
      console.log('Price:', translation.total_price, 'credits');
      return result;
    }
    
    if (result.status === 'ERROR') {
      console.error('Translation failed:', result.errors);
      return result;
    }
    
    // Wait 3 seconds, then retry
    await new Promise(r => setTimeout(r, 3000));
    attempts++;
  }
  
  throw new Error('Polling timeout');
};
```

**React Integration**:
```typescript
const TranslationStatus = ({ correlationId }) => {
  const { checkTranslationStatus } = useAPI();
  const [status, setStatus] = useState('pending');
  const [translation, setTranslation] = useState(null);

  useEffect(() => {
    const poll = async () => {
      const result = await checkTranslationStatus(correlationId);
      
      if (result.status === 'COMPLETED') {
        setStatus('completed');
        setTranslation(result.data);
      } else if (result.status === 'ERROR') {
        setStatus('error');
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [correlationId]);

  if (status === 'completed') {
    return <DownloadLink url={translation.url} />;
  }

  return <LoadingSpinner message="Translating subtitles..." />;
};
```

---

### getTranslationLanguagesForApi()

Retrieves supported languages for a specific translation model.

**Endpoint**: `POST /ai/info/translation_languages`

**Parameters**:
- `apiId`: `string` - Model name (e.g., "DeepL")

**Request**:
```typescript
Headers: {
  'Api-Key': string,
  'Authorization': 'Bearer {token}',
  'Content-Type': 'application/json'
}

Body: {
  api: 'DeepL'
}
```

**Implementation**:
```typescript
async getTranslationLanguagesForApi(
  apiId: string
): Promise<{
  success: boolean;
  data?: LanguageInfo[];
  error?: string;
}>
```

**Response**:
```typescript
{
  success: true,
  data: [
    { language_code: 'en', language_name: 'English' },
    { language_code: 'es', language_name: 'Spanish' },
    { language_code: 'fr', language_name: 'French' },
    { language_code: 'de', language_name: 'German' },
    // ... more languages supported by DeepL
  ]
}
```

**Caching**: Result cached per API ID

**Usage**:
```typescript
const { getTranslationLanguagesForApi } = useAPI();

const loadLanguages = async (modelName) => {
  const result = await getTranslationLanguagesForApi(modelName);
  if (result.success) {
    setTargetLanguages(result.data);
  }
};
```

**Note**: Response format differs from transcription:
- Can return array directly
- Can return object keyed by API name: `{ DeepL: [...], Google: [...] }`
- Code handles both formats

---

### getTranslationApisForLanguage()

Retrieves available translation APIs for a language pair.

**Endpoint**: `POST /ai/info/translation_apis`

**Parameters**:
- `sourceLanguage`: `string` - Source language code (e.g., "en")
- `targetLanguage`: `string` - Target language code (e.g., "es")

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
async getTranslationApisForLanguage(
  sourceLanguage: string,
  targetLanguage: string
): Promise<{
  success: boolean;
  data?: string[];
  error?: string;
}>
```

**Response**:
```typescript
{
  success: true,
  data: ['DeepL', 'Google', 'Microsoft']
}
```

**Caching**: Result cached with key: `translation_apis_${source}_${target}`

**Usage**:
```typescript
const { getTranslationApisForLanguage } = useAPI();

const getAvailableModels = async (fromLang, toLang) => {
  const result = await getTranslationApisForLanguage(fromLang, toLang);
  if (result.success) {
    // ['DeepL', 'Google']
    setAvailableModels(result.data);
  }
};
```

**Note**: Current implementation returns all available APIs regardless of language pair. Language filtering should be done client-side using `getTranslationInfo()` data.

---

## Complete Workflow Example

```typescript
import { useAPI } from './contexts/APIContext';

function TranslationWorkflow() {
  const {
    getTranslationInfo,
    getTranslationLanguagesForApi,
    initiateTranslation,
    checkTranslationStatus
  } = useAPI();

  const [models, setModels] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [translation, setTranslation] = useState(null);

  // Load models on mount
  useEffect(() => {
    const loadModels = async () => {
      const result = await getTranslationInfo();
      if (result.success) {
        setModels(result.data.apis);
      }
    };
    loadModels();
  }, []);

  // Load languages for selected model
  const loadLanguages = async (modelName) => {
    const result = await getTranslationLanguagesForApi(modelName);
    if (result.success) {
      setLanguages(result.data);
    }
  };

  // Handle subtitle translation
  const handleTranslate = async (subtitleFile, options) => {
    const result = await initiateTranslation(subtitleFile, options);

    if (result.status === 'CREATED') {
      const correlationId = result.correlation_id;
      
      // Poll for completion
      pollCompletion(correlationId);
    }
  };

  // Poll for completion
  const pollCompletion = async (correlationId) => {
    let attempts = 0;
    
    while (attempts < 60) {
      const result = await checkTranslationStatus(correlationId);
      
      if (result.status === 'COMPLETED') {
        setTranslation(result.data);
        return result.data;
      }
      
      if (result.status === 'ERROR') {
        throw new Error(result.errors.join(', '));
      }
      
      await new Promise(r => setTimeout(r, 3000));
      attempts++;
    }
    
    throw new Error('Translation timeout');
  };

  return (
    <div>
      {/* Model selection */}
      <select onChange={(e) => loadLanguages(e.target.value)}>
        {models.map(model => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>

      {/* Language selection */}
      <LanguageSelector languages={languages} />

      {/* File upload */}
      <SubtitleUploader onUpload={handleTranslate} />

      {/* Result */}
      {translation && (
        <div>
          <p>Translated: {translation.file_name}</p>
          <a href={translation.url}>Download</a>
          <p>Credits used: {translation.total_price}</p>
        </div>
      )}
    </div>
  );
}
```

## Comparison: Transcription vs Translation

| Feature | Transcription | Translation |
|---------|---------------|-------------|
| Input | Audio/Video file | SRT/VTT subtitle file |
| Output | Subtitle file | Subtitle file |
| Processing Time | 0.5x-2x real-time | 2-10x real-time |
| Typical Cost | Lower | Higher (~1.5x) |
| Models | Whisper, Google Speech | DeepL, Google Translate |
| Async | Yes | Yes |
| Languages | 100+ | 30-100+ |

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `400 Bad Request` | Invalid language pair or file format | Check supported languages, validate file |
| `401 Unauthorized` | Missing/invalid token | Re-authenticate |
| `415 Unsupported Media Type` | File not SRT/VTT | Convert to supported format |
| `429 Too Many Requests` | Rate limit | Wait and retry |
| `Language pair not supported` | Model doesn't support languages | Choose different model or language pair |

## Best Practices

1. **Validate subtitle files** before translation
   - Check format (SRT/VTT)
   - Check encoding (UTF-8 recommended)
   - Check for corrupted content

2. **Choose appropriate model**
   - DeepL: Better quality, fewer languages
   - Google: More languages, good quality

3. **Monitor costs**
   - Translation costs more than transcription
   - Large files consume more credits

4. **Handle special characters**
   - Ensure UTF-8 encoding
   - Test with non-Latin scripts

5. **Preserve formatting**
   - Timestamps remain unchanged
   - Only text content is translated

## Performance Considerations

- **Small files** (under 500 lines): Near-instant
- **Medium files** (500-2000 lines): 1-5 minutes
- **Large files** (2000+ lines): 5-20 minutes
- **Network**: File upload time depends on size

## Related Methods

- [Transcription Services](./transcription.md) - Convert audio to subtitles
- [Subtitle Operations](./subtitles.md) - Download and search subtitles
- [Error Handling](./retry-error.md) - Retry strategies
