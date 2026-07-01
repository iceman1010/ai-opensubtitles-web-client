import * as fileFormatsConfig from '../config/fileFormats.json';

export const isVideoFile = (fileName: string): boolean => {
  const ext = fileName.toLowerCase().split('.').pop();
  return ext ? fileFormatsConfig.video.includes(ext) : false;
};

export const isAudioFile = (fileName: string): boolean => {
  const ext = fileName.toLowerCase().split('.').pop();
  return ext ? fileFormatsConfig.audio.includes(ext) : false;
};

export const isSubtitleFile = (fileName: string): boolean => {
  const ext = fileName.toLowerCase().split('.').pop();
  return ext ? fileFormatsConfig.subtitle.includes(ext) : false;
};

export const isAudioVideoFile = (fileName: string): boolean => isVideoFile(fileName) || isAudioFile(fileName);

export const isSupportedFile = (fileName: string): boolean => isVideoFile(fileName) || isAudioFile(fileName) || isSubtitleFile(fileName);
