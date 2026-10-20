import { describe, it, expect } from 'vitest';
import {
  languageCodeMatches,
  findModelsCompatibleWithAllCodes,
  getPreferredLanguageVariantForModel,
} from './utils';
import { LanguageInfo } from '../../services/api';

const makeLang = (code: string, name?: string): LanguageInfo => ({
  language_code: code,
  language_name: name || code,
});

describe('languageCodeMatches', () => {
  it('matches exact codes case-insensitively', () => {
    expect(languageCodeMatches('de', 'de')).toBe(true);
    expect(languageCodeMatches('DE', 'de')).toBe(true);
    expect(languageCodeMatches('de', 'fr')).toBe(false);
  });

  it('matches region variants of the detected code', () => {
    expect(languageCodeMatches('de', 'de-DE')).toBe(true);
    expect(languageCodeMatches('pt', 'pt_BR')).toBe(true);
    expect(languageCodeMatches('zh', 'zh-CN')).toBe(true);
  });

  it('matches on shared base code', () => {
    expect(languageCodeMatches('en', 'en_US')).toBe(true);
  });

  it('does not match when the API code is less specific than the detected code', () => {
    // Same one-directional semantics as MainScreen.findCompatibleModels
    expect(languageCodeMatches('de-DE', 'de')).toBe(false);
  });

  it('does not match unrelated codes sharing a prefix', () => {
    expect(languageCodeMatches('de', 'den')).toBe(false);
    expect(languageCodeMatches('de', 'd')).toBe(false);
  });
});

describe('findModelsCompatibleWithAllCodes', () => {
  const languagesByApi = {
    whisper: [makeLang('en', 'English'), makeLang('de', 'German')],
    google: [makeLang('en', 'English'), makeLang('de', 'German'), makeLang('fr', 'French')],
    limited: [makeLang('en', 'English')],
  };
  const apis = ['whisper', 'google', 'limited'];

  it('returns only models supporting every detected code', () => {
    const result = findModelsCompatibleWithAllCodes(apis, languagesByApi, ['de', 'fr']);
    expect(result).toEqual(['google']);
  });

  it('keeps server order among compatible models', () => {
    const result = findModelsCompatibleWithAllCodes(apis, languagesByApi, ['en', 'de']);
    expect(result).toEqual(['whisper', 'google']);
  });

  it('deduplicates detected codes', () => {
    const result = findModelsCompatibleWithAllCodes(apis, languagesByApi, ['de', 'DE']);
    expect(result).toEqual(['whisper', 'google']);
  });

  it('returns empty list when no model covers all codes', () => {
    const result = findModelsCompatibleWithAllCodes(apis, languagesByApi, ['en', 'fr', 'ja']);
    expect(result).toEqual([]);
  });

  it('returns empty list for empty inputs', () => {
    expect(findModelsCompatibleWithAllCodes([], languagesByApi, ['de'])).toEqual([]);
    expect(findModelsCompatibleWithAllCodes(apis, languagesByApi, [])).toEqual([]);
    expect(findModelsCompatibleWithAllCodes(undefined, languagesByApi, ['de'])).toEqual([]);
  });

  it('skips models without a loaded language list', () => {
    const result = findModelsCompatibleWithAllCodes(['whisper', 'unknown'], languagesByApi, ['en']);
    expect(result).toEqual(['whisper']);
  });

  it('supports a flat language array shared by all models', () => {
    const result = findModelsCompatibleWithAllCodes(['a', 'b'], [makeLang('de')], ['de']);
    expect(result).toEqual(['a', 'b']);
  });
});

describe('getPreferredLanguageVariantForModel', () => {
  it('maps a consolidated preferred language id to the simple variant of the model', () => {
    const modelLanguages = [makeLang('de-DE', 'German (Germany)'), makeLang('de', 'German'), makeLang('en', 'English')];
    expect(getPreferredLanguageVariantForModel(modelLanguages, 'google', 'german')).toBe('de');
  });

  it('falls back to the first variant when no simple code exists', () => {
    const modelLanguages = [makeLang('pt-BR', 'Portuguese (Brazil)')];
    expect(getPreferredLanguageVariantForModel(modelLanguages, 'google', 'portuguese-br')).toBe('pt-BR');
  });

  it('returns null for unknown preferred language ids', () => {
    const modelLanguages = [makeLang('en', 'English')];
    expect(getPreferredLanguageVariantForModel(modelLanguages, 'google', 'klingon')).toBeNull();
  });

  it('returns null for auto-detect and empty inputs', () => {
    const modelLanguages = [makeLang('auto', 'Auto-detect'), makeLang('en', 'English')];
    expect(getPreferredLanguageVariantForModel(modelLanguages, 'google', 'auto-detect')).toBeNull();
    expect(getPreferredLanguageVariantForModel(modelLanguages, 'google', undefined)).toBeNull();
    expect(getPreferredLanguageVariantForModel([], 'google', 'english')).toBeNull();
  });
});
