import React, { useMemo } from 'react';
import { TranscriptionInfo } from '../services/api';
import SmartSelect, { SmartSelectOption } from './SmartSelect';
import {
  consolidateLanguages,
  buildCompatibilityMatrix,
  getBestVariantForApi,
  getConsolidatedLanguageById,
  getConsolidatedLanguageByCode
} from '../utils/languageMapper';
import * as fileFormatsConfig from '../config/fileFormats.json';

interface ImprovedTranscriptionOptionsProps {
  options: {
    language: string;
    model: string;
    format: string;
  };
  setOptions: React.Dispatch<React.SetStateAction<{
    language: string;
    model: string;
    format: string;
  }>>;
  transcriptionInfo: TranscriptionInfo | null;
  disabled?: boolean;
}

const ImprovedTranscriptionOptions: React.FC<ImprovedTranscriptionOptionsProps> = ({
  options,
  setOptions,
  transcriptionInfo,
  disabled = false
}) => {
  const { consolidatedLanguages, compatibilityMatrix } = useMemo(() => {
    if (!transcriptionInfo) {
      return { consolidatedLanguages: [], compatibilityMatrix: {} };
    }

    let languagesByApi: { [api: string]: any[] } = {};

    if (Array.isArray(transcriptionInfo.languages)) {
      transcriptionInfo.apis.forEach((api: string) => {
        languagesByApi[api] = transcriptionInfo.languages as any[];
      });
    } else if (typeof transcriptionInfo.languages === 'object') {
      languagesByApi = transcriptionInfo.languages;
    }

    const consolidated = consolidateLanguages(languagesByApi);
    const compatibility = buildCompatibilityMatrix(languagesByApi, transcriptionInfo.apis);

    return { consolidatedLanguages: consolidated, compatibilityMatrix: compatibility };
  }, [transcriptionInfo]);

  const modelOptions: SmartSelectOption[] = useMemo(() => {
    if (!transcriptionInfo) return [];
    return transcriptionInfo.apis.map((api: string) => ({
      id: api,
      label: api.toUpperCase(),
      compatible: true
    }));
  }, [transcriptionInfo]);

  const languageOptions: SmartSelectOption[] = useMemo(() => {
    return consolidatedLanguages.map(lang => {
      const compatibleApis = compatibilityMatrix[lang.id] || [];
      const isCompatibleWithCurrentModel = options.model ? compatibleApis.includes(options.model) : true;

      let tooltip = '';
      if (!isCompatibleWithCurrentModel && compatibleApis.length > 0) {
        tooltip = `Available in: ${compatibleApis.map(api => api.toUpperCase()).join(', ')}`;
      }

      return {
        id: lang.id,
        label: lang.displayName,
        compatible: isCompatibleWithCurrentModel,
        tooltip: tooltip || undefined
      };
    });
  }, [consolidatedLanguages, compatibilityMatrix, options.model]);

  const currentConsolidated = useMemo(() => {
    if (options.language === 'auto') {
      return consolidatedLanguages.find(lang => lang.id === 'auto-detect');
    }
    return getConsolidatedLanguageByCode(consolidatedLanguages, options.language);
  }, [consolidatedLanguages, options.language]);

  const handleModelChange = (newModel: string) => {
    setOptions(prev => ({ ...prev, model: newModel }));
    if (currentConsolidated) {
      const compatibleApis = compatibilityMatrix[currentConsolidated.id] || [];
      if (!compatibleApis.includes(newModel)) {
        setOptions(prev => ({ ...prev, language: 'auto' }));
      }
    }
  };

  const handleLanguageSelection = (consolidatedId: string) => {
    const consolidatedLang = getConsolidatedLanguageById(consolidatedLanguages, consolidatedId);
    if (!consolidatedLang) return;

    if (consolidatedId === 'auto-detect') {
      setOptions(prev => ({ ...prev, language: 'auto' }));
      return;
    }

    const bestVariant = getBestVariantForApi(consolidatedLang, options.model);
    if (bestVariant) {
      setOptions(prev => ({ ...prev, language: bestVariant }));
    }
  };

  const handleIncompatibleLanguageClick = (consolidatedId: string) => {
    const compatibleApis = compatibilityMatrix[consolidatedId] || [];
    if (compatibleApis.length > 0) {
      const newModel = compatibleApis[0];
      setOptions(prev => ({ ...prev, model: newModel }));
      setTimeout(() => handleLanguageSelection(consolidatedId), 100);
    }
  };

  return (
    <div className="options-container">
      <h3>Transcription Options</h3>

      <div className="form-group">
        <label htmlFor="transcription-model">Model:</label>
        <SmartSelect
          id="transcription-model"
          value={options.model}
          options={modelOptions}
          onChange={handleModelChange}
          disabled={disabled}
          placeholder="Select AI Model"
        />
      </div>

      <div className="form-group">
        <label htmlFor="transcription-language">Source Language:</label>
        <SmartSelect
          id="transcription-language"
          value={currentConsolidated?.id || ''}
          options={languageOptions}
          onChange={handleLanguageSelection}
          onIncompatibleClick={handleIncompatibleLanguageClick}
          disabled={disabled}
          placeholder="Select Language"
        />
      </div>

      <div className="form-group">
        <label htmlFor="transcription-format">Export Format:</label>
        <select
          id="transcription-format"
          value={options.format}
          onChange={(e) => setOptions(prev => ({ ...prev, format: e.target.value }))}
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

export default ImprovedTranscriptionOptions;
