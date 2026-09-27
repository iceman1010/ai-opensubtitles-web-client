import { describe, it, expect } from 'vitest';
import {
  consolidateLanguages,
  buildCompatibilityMatrix,
  getBestVariantForApi,
  getConsolidatedLanguageById,
  getConsolidatedLanguageByCode,
  resolveLanguageForApi,
  ConsolidatedLanguage,
} from './languageMapper';

const makeLang = (code: string, name: string) => ({ language_code: code, language_name: name });

describe('consolidateLanguages', () => {
  it('deduplicates variants into a single consolidated language', () => {
    const input = {
      api1: [makeLang('en', 'English'), makeLang('en-US', 'English (US)')],
      api2: [makeLang('en-GB', 'English (UK)')],
    };
    const result = consolidateLanguages(input);
    const english = result.find(l => l.id === 'english');
    expect(english).toBeDefined();
    expect(english!.variants.length).toBe(3);
  });

  it('sorts auto-detect first', () => {
    const input = {
      api1: [makeLang('fr', 'French'), makeLang('auto', 'Auto-detect')],
    };
    const result = consolidateLanguages(input);
    expect(result[0].id).toBe('auto-detect');
  });

  it('sorts remaining languages alphabetically', () => {
    const input = {
      api1: [makeLang('fr', 'French'), makeLang('de', 'German'), makeLang('ar', 'Arabic')],
    };
    const result = consolidateLanguages(input);
    const names = result.map(l => l.displayName);
    expect(names).toEqual(['Arabic', 'French', 'German']);
  });

  it('handles empty input', () => {
    expect(consolidateLanguages({})).toEqual([]);
  });

  it('does not duplicate same code+api combo', () => {
    const input = {
      api1: [makeLang('en', 'English'), makeLang('en', 'English')],
    };
    const result = consolidateLanguages(input);
    const english = result.find(l => l.id === 'english');
    expect(english!.variants.length).toBe(1);
  });
});

describe('buildCompatibilityMatrix', () => {
  it('maps consolidated IDs to supporting APIs', () => {
    const input = {
      api1: [makeLang('en', 'English')],
      api2: [makeLang('en-US', 'English (US)'), makeLang('fr', 'French')],
    };
    const matrix = buildCompatibilityMatrix(input, ['api1', 'api2']);
    expect(matrix['english']).toContain('api1');
    expect(matrix['english']).toContain('api2');
    expect(matrix['french']).toEqual(['api2']);
  });

  it('handles missing API gracefully', () => {
    const matrix = buildCompatibilityMatrix({}, ['api1']);
    expect(Object.keys(matrix)).toHaveLength(0);
  });
});

describe('getBestVariantForApi', () => {
  const lang: ConsolidatedLanguage = {
    id: 'english',
    displayName: 'English',
    variants: [
      { code: 'en-US', name: 'English (US)', api: 'api1' },
      { code: 'en', name: 'English', api: 'api1' },
      { code: 'en-GB', name: 'English (UK)', api: 'api2' },
    ],
  };

  it('prefers simple code without region suffix', () => {
    expect(getBestVariantForApi(lang, 'api1')).toBe('en');
  });

  it('returns first variant if no simple code exists', () => {
    expect(getBestVariantForApi(lang, 'api2')).toBe('en-GB');
  });

  it('returns null when API has no variants', () => {
    expect(getBestVariantForApi(lang, 'api3')).toBeNull();
  });
});

describe('getConsolidatedLanguageById', () => {
  const langs: ConsolidatedLanguage[] = [
    { id: 'english', displayName: 'English', variants: [] },
    { id: 'french', displayName: 'French', variants: [] },
  ];

  it('finds by id', () => {
    expect(getConsolidatedLanguageById(langs, 'french')?.displayName).toBe('French');
  });

  it('returns undefined for missing id', () => {
    expect(getConsolidatedLanguageById(langs, 'german')).toBeUndefined();
  });
});

describe('getConsolidatedLanguageByCode', () => {
  const langs: ConsolidatedLanguage[] = [
    {
      id: 'english',
      displayName: 'English',
      variants: [{ code: 'en', name: 'English', api: 'api1' }],
    },
  ];

  it('finds by variant code', () => {
    expect(getConsolidatedLanguageByCode(langs, 'en')?.id).toBe('english');
  });

  it('returns undefined for unknown code', () => {
    expect(getConsolidatedLanguageByCode(langs, 'xx')).toBeUndefined();
  });
});

describe('resolveLanguageForApi', () => {
  const bareCodes = [makeLang('en', 'English'), makeLang('ja', 'Japanese'), makeLang('de', 'German')];
  const localeCodes = [makeLang('ja-JP', 'Japanese'), makeLang('en-US', 'English (US)')];

  it('keeps codes that exist in the API list unchanged', () => {
    expect(resolveLanguageForApi('ja', bareCodes)).toBe('ja');
  });

  it('remaps a regional code to the API base code', () => {
    expect(resolveLanguageForApi('ja-JP', bareCodes)).toBe('ja');
  });

  it('remaps a base code to the API regional code', () => {
    expect(resolveLanguageForApi('ja', localeCodes)).toBe('ja-JP');
  });

  it('remaps underscore variant formats', () => {
    expect(resolveLanguageForApi('en_uk', [makeLang('en', 'English')])).toBe('en');
  });

  it('falls back to auto when the language is not supported', () => {
    expect(resolveLanguageForApi('fr', localeCodes)).toBe('auto');
  });

  it('passes auto through untouched', () => {
    expect(resolveLanguageForApi('auto', bareCodes)).toBe('auto');
  });

  it('returns auto when no candidate exists', () => {
    expect(resolveLanguageForApi(undefined, bareCodes)).toBe('auto');
  });

  it('keeps the candidate when no language list is available', () => {
    expect(resolveLanguageForApi('ja-JP', undefined)).toBe('ja-JP');
    expect(resolveLanguageForApi('ja-JP', [])).toBe('ja-JP');
  });
});
