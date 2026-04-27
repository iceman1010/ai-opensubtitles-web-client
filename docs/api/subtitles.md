# Subtitle Search and Download

Search, download, and manage subtitle files from the OpenSubtitles database.

## Overview

These functions interface with the OpenSubtitles.com subtitle database to find and download subtitles for movies, TV shows, and other media.

## Key Types

```typescript
interface SubtitleSearchParams {
  query?: string;                    // Search query
  imdb_id?: string;                  // IMDB ID (e.g., "tt1234567")
  tmdb_id?: string;                  // TMDB ID
  parent_imdb_id?: string;           // Parent IMDB ID (for episodes)
  parent_tmdb_id?: string;           // Parent TMDB ID
  moviehash?: string;                // Movie hash
  languages?: string;                // Comma-separated language codes
  episode_number?: number;
  season_number?: number;
  year?: number;
  type?: string;                     // "movie" or "episode"
  page?: number;                     // Pagination (default: 1)
  order_by?: string;                 // Sort field
  order_direction?: string;          // "asc" or "desc"
  ai_translated?: boolean;
  foreign_parts_only?: boolean;
  hearing_impaired?: boolean;
  machine_translated?: boolean;
  trusted_sources?: boolean;
  user_id?: string;
  parent_feature_id?: string;
}

interface SubtitleLanguage {
  language_code: string;   // e.g., "en", "es"
  language_name: string;   // e.g., "English", "Spanish"
}
```

## Methods

### searchSubtitles()

Searches the OpenSubtitles database for subtitles.

**Endpoint**: `GET /proxy/subtitles`

**Parameters**: `SubtitleSearchParams` object

**Request Headers**:
```typescript
{
  'Api-Key': string,
  'Authorization': 'Bearer {token}'
}
```

**Query String**: Built from `SubtitleSearchParams`
```
?query=Inception&languages=en,es&page=1
```

**Implementation**:
```typescript
async searchSubtitles(
  params: SubtitleSearchParams
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}>
```

**Request Example**:
```typescript
const params = {
  query: 'Inception',
  languages: 'en',
  page: 1
};

const result = await searchSubtitles(params);
```

**Success Response**:
```typescript
{
  success: true,
  data: {
    page: 1,
    total_pages: 5,
    total_count: 127,
    data: [
      {
        id: 123456,
        type: 'subtitle',
        language_code: 'en',
        language_name: 'English',
        uploader: {
          uploader_id: 123,
          uploader_name: 'JohnDoe',
          uploader_rank: 'silver member'
        },
        is_from_trusted: true,
        is_ai_translated: false,
        is_foreign_parts_only: false,
        ai_translated: '0',
        foreign_parts_only: '0',
        hearing_impaired: '0',
        machine_translated: '0',
        movie: {
          id: 27205,
          imdb_id: 'tt1375666',
          title: 'Inception',
          year: 2010,
          type: 'movie'
        },
        file: {
          file_id: 456789,
          file_name: 'Inception.2010.1080p.BluRay.x264.YIFY.srt',
          file_size: 15420,
          file_size_byte: 58982,
          file_extension: 'srt'
        },
        ratings: '8.5',
        downloads: 1245,
        likes: 89,
        comments: 12,
        timestamps: [],
        upload_date: '2021-07-15',
        release: 'YIFY',
        framerate: '23.976',
        votes: '5',
        points: '25',
        link: 'https://www.opensubtitles.com/subtitles/123456'
      },
      // ... more results
    ]
  }
}
```

**Error Response**:
```typescript
{
  success: false,
  error: 'Request failed: 404 - Not found'
}
```

**Caching**: Not cached (search results change frequently)

**Retry Logic**: 3 attempts on network errors

### Common Search Patterns

#### Search by Movie Title
```typescript
const result = await searchSubtitles({
  query: 'Inception',
  page: 1
});
```

#### Filter by Language
```typescript
const result = await searchSubtitles({
  query: 'Inception',
  languages: 'en,es,fr',  // Multiple languages
  page: 1
});
```

#### Search by IMDB ID
```typescript
const result = await searchSubtitles({
  imdb_id: 'tt1375666'
});
```

#### Filter for Hearing Impaired
```typescript
const result = await searchSubtitles({
  query: 'Inception',
  hearing_impaired: true
});
```

#### Search for TV Show Episode
```typescript
const result = await searchSubtitles({
  query: 'Breaking Bad',
  type: 'episode',
  season_number: 1,
  episode_number: 1
});
```

#### Trusted Sources Only
```typescript
const result = await searchSubtitles({
  query: 'Inception',
  trusted_sources: true
});
```

---

### downloadSubtitle()

Downloads a subtitle file from OpenSubtitles.

**Endpoint**: `POST /proxy/download`

**Parameters**:
```typescript
interface SubtitleDownloadParams {
  file_id: number;     // Required - File ID from search results
  sub_format?: string; // Optional - Output format (srt, vtt, etc.)
  file_name?: string;  // Optional - Custom filename
  in_fps?: number;     // Optional - Input frame rate
  out_fps?: number;    // Optional - Output frame rate
  timeshift?: number;  // Optional - Time shift in milliseconds
  force_download?: boolean; // Optional - Force re-download
}
```

**Request Headers**:
```typescript
{
  'Api-Key': string,
  'Authorization': 'Bearer {token}',
  'Content-Type': 'application/json'
}
```

**Request Body**:
```typescript
{
  file_id: 123456,
  sub_format: 'srt'
}
```

**Implementation**:
```typescript
async downloadSubtitle(
  params: SubtitleDownloadParams
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}>
```

**Success Response - JSON**:
```typescript
{
  success: true,
  data: {
    file: "1\n00:00:01,000 --> 00:00:04,000\nHello world\n\n...",
    // Subtitle content as string
  }
}
```

**Success Response - Redirect**:
```typescript
{
  success: true,
  data: {
    // May contain download URL or metadata
  }
}
```

**Error Response**:
```typescript
{
  success: false,
  error: 'Request failed: 404 - File not found'
}
```

**Authentication**: Requires valid token (unlike other subtitle methods)

**Usage**:
```typescript
const { downloadSubtitle } = useAPI();

const handleDownload = async (fileId) => {
  const result = await downloadSubtitle({
    file_id: fileId,
    sub_format: 'srt'
  });

  if (result.success) {
    // Save subtitle file
    const content = result.data.file;
    saveAsFile(content, 'subtitle.srt');
  }
};
```

---

### getSubtitleSearchLanguages()

Retrieves all available languages for subtitle search.

**Endpoint**: `GET /infos/languages`

**Note**: This calls OpenSubtitles directly (not the AI service)

**Request Headers**:
```typescript
{
  'Accept': 'application/json',
  'Api-Key': string
}
```

**Implementation**:
```typescript
async getSubtitleSearchLanguages(): Promise<{
  success: boolean;
  data?: SubtitleLanguage[];
  error?: string;
}>
```

**Response**:
```typescript
{
  success: true,
  data: [
    {
      language_code: 'en',
      language_name: 'English'
    },
    {
      language_code: 'es',
      language_name: 'Spanish'
    },
    {
      language_code: 'fr',
      language_name: 'French'
    },
    // ... 100+ more languages
  ]
}
```

**Caching**: 24-hour cache with timestamp validation

**Cache Key**: `subtitle_search_languages`

**Usage**:
```typescript
const { getSubtitleSearchLanguages } = useAPI();

const loadLanguages = async () => {
  const result = await getSubtitleSearchLanguages();
  if (result.success) {
    setAvailableLanguages(result.data);
  }
};
```

**Popular Language Codes**:
```typescript
[
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'hi', name: 'Hindi' }
]
```

---

### downloadFile()

Downloads a file from a direct URL.

**Endpoint**: `GET {url}`

**Parameters**:
- `url`: `string` - Direct download URL

**Request Headers**:
```typescript
{
  'Api-Key': string,
  'Authorization': 'Bearer {token}'
}
```

**Implementation**:
```typescript
async downloadFile(
  url: string
): Promise<{
  success: boolean;
  content?: string;
  error?: string;
}>
```

**Success Response**:
```typescript
{
  success: true,
  content: "...file content as text..."
}
```

**Usage**: Used internally to download subtitle files from result URLs

---

### downloadFileByMediaId()

Downloads a file by media ID from the AI service.

**Endpoint**: `GET /ai/files/{mediaId}/{fileName}`

**Parameters**:
- `mediaId`: `string` - Media identifier
- `fileName`: `string` - Filename

**Request Headers**:
```typescript
{
  'Api-Key': string,
  'Authorization': 'Bearer {token}'
}
```

**Implementation**:
```typescript
async downloadFileByMediaId(
  mediaId: string,
  fileName: string
): Promise<{
  success: boolean;
  content?: string;
  error?: string;
}>
```

**Usage**: For files processed by the AI service (transcriptions, translations)

---

## Complete Workflow Example

```typescript
import { useAPI } from './contexts/APIContext';

function SubtitleSearchAndDownload() {
  const {
    searchSubtitles,
    downloadSubtitle,
    getSubtitleSearchLanguages
  } = useAPI();

  const [results, setResults] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  // Load available languages
  useEffect(() => {
    const loadLanguages = async () => {
      const result = await getSubtitleSearchLanguages();
      if (result.success) {
        setLanguages(result.data);
      }
    };
    loadLanguages();
  }, []);

  // Search for subtitles
  const handleSearch = async (query) => {
    const result = await searchSubtitles({
      query,
      languages: selectedLanguage,
      trusted_sources: true,
      page: 1
    });

    if (result.success) {
      setResults(result.data.data || []);
    }
  };

  // Download subtitle
  const handleDownload = async (fileId, fileName) => {
    const result = await downloadSubtitle({
      file_id: fileId,
      sub_format: 'srt'
    });

    if (result.success) {
      // Create download link
      const content = result.data.file;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div>
      {/* Search form */}
      <div>
        <select 
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
        >
          {languages.map(lang => (
            <option key={lang.language_code} value={lang.language_code}>
              {lang.language_name}
            </option>
          ))}
        </select>
        
        <input 
          type="text" 
          placeholder="Search movies..."
          onKeyPress={(e) => e.key === 'Enter' && handleSearch(e.target.value)}
        />
        
        <button onClick={() => handleSearch(query)}>Search</button>
      </div>

      {/* Results */}
      <div className="results">
        {results.map(subtitle => (
          <div key={subtitle.id} className="subtitle-item">
            <h3>{subtitle.movie.title} ({subtitle.movie.year})</h3>
            <p>Language: {subtitle.language_name}</p>
            <p>Downloads: {subtitle.downloads}</p>
            <p>Rating: {subtitle.ratings}</p>
            <button onClick={() => handleDownload(
              subtitle.file.file_id,
              subtitle.file.file_name
            )}>
              Download
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Common Search Patterns

### 1. Find All Subtitles for a Movie
```typescript
const allSubtitles = [];
let page = 1;

while (true) {
  const result = await searchSubtitles({
    imdb_id: 'tt1375666',
    page
  });

  if (result.success && result.data?.data) {
    allSubtitles.push(...result.data.data);
    
    if (page >= result.data.total_pages) break;
    page++;
  } else {
    break;
  }
}
```

### 2. Find Best Quality Subtitle
```typescript
const result = await searchSubtitles({
  imdb_id: 'tt1375666',
  languages: 'en',
  trusted_sources: true
});

if (result.success && result.data?.data) {
  // Sort by downloads (popularity)
  const best = result.data.data
    .sort((a, b) => b.downloads - a.downloads)[0];
  
  return best;
}
```

### 3. Find Subtitles for TV Show Episode
```typescript
const result = await searchSubtitles({
  query: 'Breaking Bad',
  type: 'episode',
  season_number: 5,
  episode_number: 14,
  languages: 'en,es'
});
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `404 Not Found` | No subtitles found | Try different search terms |
| `401 Unauthorized` | Invalid token (download only) | Re-authenticate |
| `400 Bad Request` | Invalid parameters | Check parameter types |
| `429 Too Many Requests` | Rate limit | Wait and retry |
| Network Error | Connectivity issue | Check connection, retry |

## Best Practices

1. **Always validate results** before downloading
   ```typescript
   if (result.success && result.data?.data?.length > 0) {
     // Safe to proceed
   }
   ```

2. **Use trusted sources** when possible
   ```typescript
   trusted_sources: true
   ```

3. **Paginate properly** for large result sets
   ```typescript
   for (let page = 1; page <= total_pages; page++) {
     const result = await searchSubtitles({ query, page });
     // Process results
   }
   ```

4. **Handle encoding** when saving files
   ```typescript
   const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
   ```

5. **Rate limit your searches**
   - Don't spam search requests
   - Add small delays between requests
   - Cache language lists

## Performance Considerations

- **Search requests**: ~200-500ms each
- **Download requests**: Depends on file size
- **Language list**: Cached for 24 hours
- **Pagination**: 50-100 results per page

## Rate Limits

- Search: ~10-20 requests per minute
- Download: ~5-10 requests per minute
- Exceeding limits returns 429 error

## Related Methods

- [Translation Services](./translation.md) - Translate downloaded subtitles
- [Transcription Services](./transcription.md) - Create subtitles from audio
- [Media Search](./media.md) - Find movies/shows
