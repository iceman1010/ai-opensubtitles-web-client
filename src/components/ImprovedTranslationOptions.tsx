import React, { useMemo } from 'react';
import { TranslationInfo } from '../services/api';
import SmartSelect, { SmartSelectOption } from './SmartSelect';
import {
  consolidateLanguages,
  buildCompatibilityMatrix,
  getBestVariantForApi,
  getConsolidatedLanguageById,
  getConsolidatedLanguageByCode
} from '../utils/languageMapper';
import * as fileFormatsConfig from '../config/fileFormats.json';
import { logger } from '../utils/errorLogger';

interface ImprovedTranslationOptionsProps {
  options: {
    sourceLanguage: string;
    destinationLanguage: string;
    model: string;
    format: string;
  };
  translationInfo: TranslationInfo | null;
  onModelChange: (model: string) => void;
  onLanguageChange: (field: 'sourceLanguage' | 'destinationLanguage', language: string) => void;
  onFormatChange: (format: string) => void;
  disabled?: boolean;
}

const ImprovedTranslationOptions: React.FC<ImprovedTranslationOptionsProps> = ({
  options,
  translationInfo,
  onModelChange,
  onLanguageChange,
  onFormatChange,
  disabled = false
}) => {
  const { consolidatedLanguages, compatibilityMatrix } = useMemo(() => {
    if (!translationInfo) {
      return { consolidatedLanguages: [], compatibilityMatrix: {} };
    }

    const consolidated = consolidateLanguages(translationInfo.languages);
    const compatibility = buildCompatibilityMatrix(translationInfo.languages, translationInfo.apis);

    return { consolidatedLanguages: consolidated, compatibilityMatrix: compatibility };
  }, [translationInfo]);

  const isLanguageDataReady = useMemo(() => {
    if (!translationInfo || !options.model) return false;
    return consolidatedLanguages.some(lang =>
      lang.variants.some(v => v.api === options.model)
    );
  }, [consolidatedLanguages, options.model, translationInfo]);

  const modelOptions: SmartSelectOption[] = useMemo(() => {
    if (!translationInfo) return [];
    return translationInfo.apis.map((api: string) => ({
      id: api,
      label: api.toUpperCase(),
      compatible: true
    }));
  }, [translationInfo]);

  const buildLanguageOptions = (excludeLanguage?: string): SmartSelectOption[] => {
    return consolidatedLanguages
      .filter(lang => {
        const compatibleApis = compatibilityMatrix[lang.id] || [];
        const isCompatibleWithCurrentModel = options.model ? compatibleApis.includes(options.model) : true;
        const isSameAsOtherSelection = excludeLanguage === lang.id;
        return isCompatibleWithCurrentModel && !isSameAsOtherSelection;
      })
      .map(lang => ({
        id: lang.id,
        label: lang.displayName,
        compatible: true
      }));
  };

  const currentSourceConsolidated = useMemo(() => {
    if (options.sourceLanguage === 'auto') {
      return consolidatedLanguages.find(lang => lang.id === 'auto-detect');
    }
    return getConsolidatedLanguageByCode(consolidatedLanguages, options.sourceLanguage);
  }, [consolidatedLanguages, options.sourceLanguage]);

  const currentDestConsolidated = useMemo(() => {
    return getConsolidatedLanguageByCode(consolidatedLanguages, options.destinationLanguage);
  }, [consolidatedLanguages, options.destinationLanguage]);

  const handleLanguageSelection = (field: 'sourceLanguage' | 'destinationLanguage', consolidatedId: string) => {
    if (!isLanguageDataReady && consolidatedId !== 'auto-detect') {
      logger.warn('ImprovedTranslationOptions', 'Language data not ready yet, deferring selection');
      return;
    }

    const consolidatedLang = getConsolidatedLanguageById(consolidatedLanguages, consolidatedId);
    if (!consolidatedLang) return;

    if (consolidatedId === 'auto-detect') {
      onLanguageChange(field, 'auto');
      return;
    }

    const bestVariant = getBestVariantForApi(consolidatedLang, options.model);
    if (bestVariant) {
      onLanguageChange(field, bestVariant);
    }
  };

  return (
    <div className="options-container">
      <h3>Translation Options</h3>

      <div className="form-group">
        <label htmlFor="translation-model">Model:</label>
        <SmartSelect
          id="translation-model"
          value={options.model}
          options={modelOptions}
          onChange={onModelChange}
          disabled={disabled}
          placeholder="Select AI Model"
        />
      </div>

      <div className="form-group">
        <label htmlFor="source-language">Source Language:</label>
        <SmartSelect
          id="source-language"
          value={currentSourceConsolidated?.id || ''}
          options={buildLanguageOptions(currentDestConsolidated?.id)}
          onChange={(value) => handleLanguageSelection('sourceLanguage', value)}
          disabled={disabled || !isLanguageDataReady}
          placeholder="Select Source Language"
        />
      </div>

      <div className="form-group">
        <label htmlFor="destination-language">Destination Language:</label>
        <SmartSelect
          id="destination-language"
          value={currentDestConsolidated?.id || ''}
          options={buildLanguageOptions(currentSourceConsolidated?.id)}
          onChange={(value) => handleLanguageSelection('destinationLanguage', value)}
          disabled={disabled || !isLanguageDataReady}
          placeholder="Select Destination Language"
        />
      </div>

      <div className="form-group">
        <label htmlFor="translation-format">Export Format:</label>
        <select
          id="translation-format"
          value={options.format}
          onChange={(e) => onFormatChange(e.target.value)}
          disabled={disabled}
        >
          {fileFormatsConfig.subtitle.map(format => (
            <option key={format} value={format}>
              {format.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default ImprovedTranslationOptions;
