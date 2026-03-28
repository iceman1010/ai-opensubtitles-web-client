export interface CommitEntry {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: Date;
  avatarUrl: string;
  htmlUrl: string;
}

const CACHE_KEY = 'github_changelog_cache';
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
  data: CommitEntry[];
  timestamp: number;
}

function getCachedData(): CommitEntry[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const entry: CacheEntry = JSON.parse(cached);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return entry.data.map(c => ({
      ...c,
      date: new Date(c.date),
    }));
  } catch {
    return null;
  }
}

function setCachedData(data: CommitEntry[]): void {
  try {
    const entry: CacheEntry = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
  }
}

export async function fetchChangelog(limit: number = 25): Promise<CommitEntry[]> {
  const cached = getCachedData();
  if (cached) return cached;

  const response = await fetch(
    `https://api.github.com/repos/iceman1010/ai-opensubtitles-web-client/commits?per_page=${limit}`,
    {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch changelog: ${response.status}`);
  }

  const commits = await response.json();

  const entries: CommitEntry[] = commits.map((commit: any) => ({
    sha: commit.sha,
    shortSha: commit.sha.substring(0, 7),
    message: commit.commit.message.split('\n')[0],
    author: commit.commit.author.name,
    date: new Date(commit.commit.author.date),
    avatarUrl: commit.author?.avatar_url || `https://github.com/${commit.commit.author.name}.png`,
    htmlUrl: commit.html_url,
  }));

  setCachedData(entries);
  return entries;
}

export function clearChangelogCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
