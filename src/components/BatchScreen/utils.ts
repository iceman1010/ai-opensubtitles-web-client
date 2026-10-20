import { LanguageInfo, ServiceModel, ServicesInfo } from '../../services/api';
import { BatchFile, BatchSettings, BatchCreditStats } from './types';
import { generateFilename } from '../../utils/filenameGenerator';
import { isAudioVideoFile } from '../../utils/fileTypeUtils';
import { consolidateLanguages, getBestVariantForApi } from '../../utils/languageMapper';

export const getLanguagesForModel = (
  languages: LanguageInfo[] | { [apiName: string]: LanguageInfo[] } | undefined,
  modelId: string,
): LanguageInfo[] => {
  if (!languages) return [];
  if (Array.isArray(languages)) return languages;
  return (languages as { [key: string]: LanguageInfo[] })[modelId] || [];
};

export const normalizeModelName = (s: string): string =>
  s.replace(/[.\-_]/g, '').toLowerCase();

export const findModelPrice = (models: ServiceModel[] | undefined, selected: string) =>
  models?.find(m => m.name === selected) ||
  models?.find(m => normalizeModelName(m.name) === normalizeModelName(selected));

export const getMatchingSourceLanguages = (
  detectedCode: string | null,
  apiLanguages: LanguageInfo[],
): LanguageInfo[] => {
  if (!apiLanguages) return [];
  let matching: LanguageInfo[];
  if (!detectedCode) {
    matching = [...apiLanguages];
  } else {
    matching = apiLanguages.filter(lang =>
      lang.language_code.toLowerCase().startsWith(detectedCode.toLowerCase()),
    );
  }
  const seen = new Set<string>();
  const unique = matching.filter(lang => {
    const key = lang.language_name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.sort((a, b) => a.language_name.localeCompare(b.language_name));
};

export const autoSelectSourceLanguage = (
  detectedCode: string | null,
  apiLanguages: LanguageInfo[],
): string | undefined => {
  const matching = getMatchingSourceLanguages(detectedCode, apiLanguages);
  if (matching.length === 1) return matching[0].language_code;
  if (detectedCode && matching.length > 0) return matching[0].language_code;
  return undefined;
};

// Same matching semantics as MainScreen's findCompatibleModels:
// an API language supports a detected code when it is equal, is a region
// variant of it (de vs de-DE), or shares the same base code.
export const languageCodeMatches = (detectedCode: string, apiCode: string): boolean => {
  const detected = detectedCode.toLowerCase();
  const api = apiCode.toLowerCase();
  if (api === detected) return true;
  if (api.startsWith(detected + '-') || api.startsWith(detected + '_')) return true;
  return api.split(/[-_]/)[0] === detected;
};

export const findModelsCompatibleWithAllCodes = (
  apis: string[] | undefined,
  languagesByApi: { [apiName: string]: LanguageInfo[] } | LanguageInfo[] | undefined,
  detectedCodes: string[],
): string[] => {
  if (!apis?.length || detectedCodes.length === 0) return [];
  const uniqueCodes = Array.from(new Set(detectedCodes.map(code => code.toLowerCase())));
  const getLanguagesFor = (api: string): LanguageInfo[] => {
    if (Array.isArray(languagesByApi)) return languagesByApi;
    return (languagesByApi as { [apiName: string]: LanguageInfo[] })?.[api] || [];
  };
  return apis.filter(api => {
    const apiLanguages = getLanguagesFor(api);
    if (apiLanguages.length === 0) return false;
    return uniqueCodes.every(code =>
      apiLanguages.some(lang => languageCodeMatches(code, lang.language_code)),
    );
  });
};

// Maps a preferred language (stored as a consolidated id, e.g. 'german') to the
// best raw language_code variant offered by the given model.
export const getPreferredLanguageVariantForModel = (
  modelLanguages: LanguageInfo[],
  model: string,
  preferredLanguageId: string | undefined,
): string | null => {
  if (!modelLanguages.length || !preferredLanguageId || preferredLanguageId === 'auto-detect') return null;
  const consolidated = consolidateLanguages({ [model]: modelLanguages });
  const lang = consolidated.find(l => l.id === preferredLanguageId && l.id !== 'auto-detect');
  return lang ? getBestVariantForApi(lang, model) : null;
};

export const generateOutputFileName = (
  originalFileName: string,
  type: 'transcription' | 'translation',
  targetLanguage: string,
  outputFormat: string,
  translationModel: string,
  transcriptionModel: string,
  getTranslationLanguageNameSync: (model: string, code: string) => string | undefined,
  getTranscriptionLanguageNameSync: (model: string, code: string) => string | undefined,
  defaultFilenameFormat?: string,
): string => {
  const languageCode = targetLanguage;
  let languageName = languageCode;

  if (type === 'translation' && translationModel) {
    languageName = getTranslationLanguageNameSync(translationModel, languageCode) || languageCode;
  } else if (type === 'transcription' && transcriptionModel) {
    languageName = getTranscriptionLanguageNameSync(transcriptionModel, languageCode) || languageCode;
  }

  const filenamePattern = defaultFilenameFormat || '{filename}.{language_code}.{type}.{extension}';
  return generateFilename(filenamePattern, originalFileName, languageCode, languageName, type, outputFormat);
};

export const validateLanguageSelection = (
  queue: BatchFile[],
): { isValid: boolean; missingLanguageFiles: BatchFile[] } => {
  const missingLanguageFiles = queue.filter(file =>
    isAudioVideoFile(file.name) && file.status === 'pending' && !file.selectedSourceLanguage,
  );
  return { isValid: missingLanguageFiles.length === 0, missingLanguageFiles };
};

export const computeEstimatedCost = (
  servicesInfo: ServicesInfo | null,
  queue: BatchFile[],
  isProcessing: boolean,
  transcriptionModel: string,
  translationModel: string,
  workflowMode: string,
  findModelPrice: (models: ServiceModel[] | undefined, selected: string) => ServiceModel | undefined,
): number | null => {
  if (!servicesInfo || queue.length === 0 || isProcessing) return null;

  const enableTranslation = workflowMode === 'transcribe-and-translate';
  let total = 0;
  let hasAnyEstimate = false;

  for (const file of queue) {
    if (file.status !== 'pending') continue;

    if (file.type === 'transcription' && file.duration && transcriptionModel) {
      const model = findModelPrice(servicesInfo.Transcription, transcriptionModel);
      if (model && typeof model.price === 'number') {
        total += file.duration * model.price;
        hasAnyEstimate = true;
      }
      if (enableTranslation && translationModel && file.duration) {
        const translationModelObj = findModelPrice(servicesInfo.Translation, translationModel);
        if (translationModelObj && typeof translationModelObj.price === 'number') {
          const estimatedChars = file.duration * 15;
          total += estimatedChars * translationModelObj.price;
          hasAnyEstimate = true;
        }
      }
    }

    if (file.type === 'translation' && file.characterCount && translationModel) {
      const model = findModelPrice(servicesInfo.Translation, translationModel);
      if (model && typeof model.price === 'number') {
        total += file.characterCount * model.price;
        hasAnyEstimate = true;
      }
    }
  }

  return hasAnyEstimate ? total : null;
};

export const computeQueueAnalysis = (queue: BatchFile[]) => ({
  hasTranscriptionFiles: queue.some(f => f.type === 'transcription'),
  hasTranslationFiles: queue.some(f => f.type === 'translation'),
});

export const computeUiState = (
  queueAnalysis: { hasTranscriptionFiles: boolean; hasTranslationFiles: boolean },
  enableChaining: boolean,
) => ({
  transcriptionEnabled: queueAnalysis.hasTranscriptionFiles,
  translationEnabled: queueAnalysis.hasTranslationFiles || (enableChaining && queueAnalysis.hasTranscriptionFiles),
  chainingEnabled: queueAnalysis.hasTranscriptionFiles,
  shouldDisableChaining: queueAnalysis.hasTranslationFiles && !queueAnalysis.hasTranscriptionFiles,
});
