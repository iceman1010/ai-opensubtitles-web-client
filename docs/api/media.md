# Media and Feature Search

Search for movies, TV shows, and manage recent media history.

## Overview

These functions help discover media content and track processing history.

## Methods

### searchForFeatures()

Searches for movies and TV shows in the database.

**Endpoint**: `GET /proxy/features`

**Parameters**:
```typescript
interface FeatureSearchParams {
  feature_id?: number;      // Specific feature ID
  full_search?: boolean;    // Enable full text search
  imdb_id?: string;         // IMDB ID (e.g., "tt1375666")
  query?: string;           // Search query (e.g., "Inception")
  query_match?: 'start' | 'word' | 'exact';  // Match type
  tmdb_id?: string;         // TMDB ID
  type?: 'movie' | 'tvshow' | 'episode';  // Media type
  year?: number;            // Release year
}
```

**Request Headers**:
```typescript
{
  'Api-Key': string,
  'Authorization': 'Bearer {token}'
}
```

**Query String**: Built from `FeatureSearchParams`
```
?query=Inception&type=movie&year=2010
```

**Implementation**:
```typescript
async searchForFeatures(
  params: FeatureSearchParams
): Promise<{
  success: boolean;
  data?: FeatureSearchResponse;
  error?: string;
}>
```

**Response**:
```typescript
{
  success: true,
  data: {
    data: [
      {
        id: "27205",
        type: "movie",
        attributes: {
          title: "Inception",
          original_title: "Inception",
          year: 2010,
          kind: "movie",
          imdb_id: 1375666,
          tmdb_id: 27205,
          feature_id: 27205,
          subtitles_count: 12453,
          seasons_count: null,
          subtitles_counts: {
            "en": 3421,
            "es": 2156,
            "fr": 1876
          },
          ai_subtitles_counts: {
            "en": 234,
            "es": 145
          },
          title_aka: ["Inception: The Beginning"],
          feature_type: "movie",
          url: "https://www.opensubtitles.com/movies/inception",
          img_url: "https://img.example.com/poster.jpg",
          seasons: null
        }
      }
    ],
    total_count: 1,
    total_pages: 1,
    page: 1,
    per_page: 50
  }
}
```

**Response Fields**:

| Field | Description |
|-------|-------------|
| `id` | Feature ID as string |
| `type` | Always "movie", "tvshow", or "episode" |
| `attributes.title` | Main title |
| `attributes.original_title` | Original language title |
| `attributes.year` | Release year |
| `attributes.imdb_id` | IMDB identifier (without "tt") |
| `attributes.tmdb_id` | TMDB identifier |
| `attributes.subtitles_count` | Total subtitle count |
| `attributes.subtitles_counts` | Count per language code |
| `attributes.ai_subtitles_counts` | AI-generated subtitle count per language |

**Caching**: Not cached (search results change frequently)

**Retry Logic**: 3 attempts on network errors

### Common Search Patterns

#### Find Movie by Title
```typescript
const result = await searchForFeatures({
  query: 'Inception',
  type: 'movie',
  year: 2010
});
```

#### Find TV Show
```typescript
const result = await searchForFeatures({
  query: 'Breaking Bad',
  type: 'tvshow'
});
```

#### Search by IMDB ID
```typescript
const result = await searchForFeatures({
  imdb_id: '1375666'
});
```

#### Full Text Search
```typescript
const result = await searchForFeatures({
  query: 'inception dream',
  full_search: true,
  query_match: 'word'  // Match any word
});
```

#### Exact Match
```typescript
const result = await searchForFeatures({
  query: 'Inception',
  query_match: 'exact'
});
```

---

### getRecentMedia()

Retrieves recently processed media items.

**Endpoint**: `POST /ai/recent_media`

**Parameters**:
- `page`: `number` - Page number (default: 1)

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
async getRecentMedia(
  page: number = 1
): Promise<{
  success: boolean;
  data?: RecentMediaItem[];
  error?: string;
}>
```

**Response**:
```typescript
{
  success: true,
  data: [
    {
      id: 12345,
      time: 1640995200,
      time_str: "2022-01-01 12:00:00",
      files: [
        "movie_123.srt",
        "movie_123_en.srt"
      ]
    },
    {
      id: 12346,
      time: 1640995100,
      time_str: "2022-01-01 11:58:20",
      files: [
        "show_episode_456.srt"
      ]
    }
  ]
}
```

**Caching**: Per-page cache
- Cache key: `recent_media_page_{page}`
- Cleared on new transcription/translation

**Usage**:
```typescript
const { getRecentMedia } = useAPI();

const loadRecent = async (page = 1) => {
  const result = await getRecentMedia(page);
  if (result.success) {
    setRecentItems(result.data || []);
  }
};
```

---

### getRecentActivities()

Retrieves recent user activities (credit usage, processing, etc.).

**Endpoint**: `POST /ai/recent_activities`

**Parameters**:
- `page`: `number` - Page number (default: 1)

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
async getRecentActivities(
  page: number = 1
): Promise<{
  success: boolean;
  data?: RecentActivityItem[];
  error?: string;
}>
```

**Response**:
```typescript
{
  success: true,
  data: [
    {
      id: 1001,
      type: 1,                    // Activity type code
      type_name: "Transcription",  // Human-readable
      credits: 1.54,              // Credits used
      time: 1640995200,
      time_str: "2022-01-01 12:00:00"
    },
    {
      id: 1002,
      type: 2,
      type_name: "Translation",
      credits: 2.31,
      time: 1640995100,
      time_str: "2022-01-01 11:58:20"
    },
    {
      id: 1003,
      type: 3,
      type_name: "Credit Purchase",
      credits: 100,               // Credits added
      time: 1640994000,
      time_str: "2022-01-01 11:40:00"
    }
  ]
}
```

**Activity Type Codes**:
- `1`: Transcription
- `2`: Translation
- `3`: Credit purchase
- `4`: Other operations

**Caching**: Per-page cache
- Cache key: `recent_activities_page_{page}`
- Cleared on new transcription/translation

**Usage**:
```typescript
const { getRecentActivities } = useAPI();

const loadActivities = async (page = 1) => {
  const result = await getRecentActivities(page);
  if (result.success) {
    setActivities(result.data || []);
  }
};

// Display in activity feed
activities.map(activity => (
  <div key={activity.id}>
    <span>{activity.time_str}</span>
    <span>{activity.type_name}</span>
    <span>{activity.credits} credits</span>
  </div>
));
```

---

## Complete Workflow Example

```typescript
import { useAPI } from './contexts/APIContext';

function MediaDashboard() {
  const {
    searchForFeatures,
    getRecentMedia,
    getRecentActivities
  } = useAPI();

  const [searchResults, setSearchResults] = useState([]);
  const [recentMedia, setRecentMedia] = useState([]);
  const [activities, setActivities] = useState([]);

  // Search for movies
  const handleSearch = async (query) => {
    const result = await searchForFeatures({
      query,
      type: 'movie',
      full_search: false
    });

    if (result.success) {
      setSearchResults(result.data?.data || []);
    }
  };

  // Load recent media
  const loadRecentMedia = async () => {
    const result = await getRecentMedia(1);
    if (result.success) {
      setRecentMedia(result.data || []);
    }
  };

  // Load activity history
  const loadActivities = async () => {
    const result = await getRecentActivities(1);
    if (result.success) {
      setActivities(result.data || []);
    }
  };

  // Initial load
  useEffect(() => {
    loadRecentMedia();
    loadActivities();
  }, []);

  return (
    <div>
      {/* Search Section */}
      <div className="search-section">
        <input 
          placeholder="Search movies or TV shows..."
          onKeyPress={(e) => e.key === 'Enter' && handleSearch(e.target.value)}
        />
        
        <div className="results">
          {searchResults.map(item => (
            <div key={item.id} className="media-item">
              <img src={item.attributes.img_url} alt={item.attributes.title} />
              <div>
                <h3>{item.attributes.title}</h3>
                <p>{item.attributes.year}</p>
                <p>{item.attributes.subtitles_count} subtitles available</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Media */}
      <div className="recent-section">
        <h2>Recent Processing</h2>
        {recentMedia.map(item => (
          <div key={item.id} className="media-item">
            <span>{item.time_str}</span>
            <span>{item.files?.length} files</span>
          </div>
        ))}
      </div>

      {/* Activity Feed */}
      <div className="activity-section">
        <h2>Recent Activity</h2>
        {activities.map(activity => (
          <div key={activity.id} className="activity-item">
            <span>{activity.time_str}</span>
            <span>{activity.type_name}</span>
            <span className={activity.credits > 0 ? 'credits-used' : 'credits-added'}>
              {activity.credits > 0 ? '-' : '+'}{Math.abs(activity.credits)} credits
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Response Field Reference

### Feature Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `title` | string | Main title in current language |
| `original_title` | string | Title in original language |
| `year` | number | Release year |
| `imdb_id` | number | IMDB ID (without "tt") |
| `tmdb_id` | number | TMDB ID |
| `subtitles_count` | number | Total subtitle count |
| `subtitles_counts` | object | Count per language code |
| `ai_subtitles_counts` | object | AI subtitle count per language |

### Recent Media Item

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Media ID |
| `time` | number | Unix timestamp |
| `time_str` | string | Formatted date/time |
| `files` | string[] | Associated filenames |

### Recent Activity Item

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Activity ID |
| `type` | number | Activity type code |
| `type_name` | string | Human-readable type |
| `credits` | number | Credits used (positive) or added (negative) |
| `time` | number | Unix timestamp |
| `time_str` | string | Formatted date/time |

## Best Practices

1. **Use specific search types** for better results
   ```typescript
   // Good - limits to movies
   type: 'movie'
   
   // Better - exact title match
   query_match: 'exact'
   ```

2. **Paginate results properly**
   ```typescript
   const allResults = [];
   for (let page = 1; page <= total_pages; page++) {
     const result = await searchForFeatures({ query, page });
     allResults.push(...result.data.data);
   }
   ```

3. **Cache aggressively for display**
   - Media info doesn't change often
   - Cache search results for 1 hour
   - Clear on user action

4. **Handle missing images gracefully**
   ```typescript
   <img 
     src={img_url} 
     onError={(e) => e.target.style.display = 'none'}
     alt={title}
   />
   ```

## Performance Considerations

- **Search requests**: ~200-400ms each
- **Results per page**: 50 items
- **Pagination**: Use `page` parameter
- **Image loading**: Lazy load for grids

## Related Methods

- [Subtitle Search](./subtitles.md) - Find subtitles for media
- [Transcription](./transcription.md) - Create subtitles from audio
- [Credits](./credits.md) - Track credit usage in activities