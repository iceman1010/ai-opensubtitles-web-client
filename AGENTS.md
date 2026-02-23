# AGENTS.md - AI OpenSubtitles Web Client

This document provides guidelines for agentic coding agents working on this codebase.

## Project Overview

A React + TypeScript web application for AI-powered subtitle transcription and translation. Uses Vite as build tool, Vitest for testing, and interfaces with the OpenSubtitles.com API.

## Build / Lint / Test Commands

```bash
# Development
npm run dev              # Start dev server on port 5174

# Build
npm run build            # Type-check and build for production (outputs to dist/)
npm run preview          # Preview production build

# Testing
npm run test             # Run all tests once
npm run test:watch       # Run tests in watch mode
npm run test:ui          # Run tests with Vitest UI

# Run a single test file
npm run test -- src/services/cache.test.ts

# Run a single test (by name pattern)
npm run test -- -t "should return cached data"
```

## Code Style Guidelines

### General

- **No comments** - Do not add comments unless explicitly requested
- **Strict TypeScript** - All code must be type-safe, no `any` unless unavoidable
- **ES Modules** - Use ES module syntax (`import`/`export`)

### File Organization

- Components: `src/components/` - React components (PascalCase, e.g., `MainScreen.tsx`)
- Services: `src/services/` - Business logic (PascalCase, e.g., `api.ts`)
- Utils: `src/utils/` - Utility functions (PascalCase, e.g., `errorLogger.ts`)
- Hooks: `src/hooks/` - Custom React hooks (camelCase, e.g., `useFileHandler.ts`)
- Config: `src/config/` - Configuration files
- Contexts: `src/contexts/` - React contexts
- Workers: `src/workers/` - Web Workers

### Naming Conventions

- **Files**: PascalCase for components/services, camelCase for hooks/utils
- **Components**: PascalCase (e.g., `MainScreen`)
- **Functions**: camelCase (e.g., `handleFileSelect`)
- **Interfaces**: PascalCase with descriptive names (e.g., `APIResponse<T>`)
- **Constants**: PascalCase for classes, SCREAMING_SNAKE for config values
- **CSS Classes**: kebab-case (e.g., `btn-primary`)

### Imports

- **Order**: React imports → external libs → internal components → utils → config
- **Relative paths**: Use `../` for same-level, `../../` for deeper paths
- **Type imports**: Use `import type { Type }` when only using types

```typescript
import React, { useState, useEffect } from 'react';
import { getProcessingType } from '../config/fileFormats';
import { APIResponse } from '../services/api';
import { logger } from '../utils/errorLogger';
import appConfig from '../config/appConfig.json';
```

### TypeScript

- Enable strict mode - always use explicit types
- Interface over type for public APIs
- Use generics for reusable utilities (e.g., `CacheManager.get<T>`)
- Avoid `any` - use `unknown` and type guards instead

### React Patterns

- Use functional components with hooks
- Destructure props in component signature
- Use `useCallback` for event handlers passed to children
- Use `useRef` for mutable refs (e.g., timeout IDs)
- Use early returns for cleaner conditionals

```typescript
function MainScreen({ config, onNavigate }: MainScreenProps) {
  const [state, setState] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAction = useCallback(() => {
    // ...
  }, [dependencies]);
}
```

### Error Handling

- Use the centralized logger: `logger.info/warn/error(category, message, data)`
- Provide user-friendly error messages in UI
- Always catch async errors and return error responses
- Use try/catch with meaningful error messages

```typescript
try {
  // operation
} catch (error) {
  logger.error('ComponentName', 'Operation failed', error);
  setStatusMessage({ type: 'error', message: 'Operation failed' });
}
```

### Testing

- Test files: `*.test.ts` in same directory as source
- Use Vitest with happy-dom for DOM testing
- Test patterns: Arrange-Act-Assert
- Mock external dependencies (fetch, localStorage)

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('CacheManager', () => {
  it('should return cached data', () => {
    CacheManager.set('test', { foo: 'bar' });
    expect(CacheManager.get('test')).toEqual({ foo: 'bar' });
  });
});
```

### API Integration

- Use `apiRequestWithRetry` for API calls with automatic retry
- Return structured responses: `{ success: boolean; data?: T; error?: string }`
- Cache API responses using `CacheManager`
- Handle both sync and async (polling) operations

### Configuration

- JSON files in `src/config/` for static config
- Use `import appConfig from '../config/appConfig.json'`
- Environment variables via `import.meta.env`

### CSS

- Use CSS variables for theming (defined in index.html or CSS files)
- Follow existing class naming: `kebab-case` with semantic names
- Prefer inline styles for dynamic values in components
