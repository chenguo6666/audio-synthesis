/** 一个已导入的片段：原始文件已被统一转成无损 FLAC 中间文件 */
export interface Clip {
  id: string;
  /** 原文件名 */
  name: string;
  /** 无损中间文件（FLAC），播放、波形、导出都基于它 */
  blob: Blob;
  url: string;
  /** 总时长（秒） */
  duration: number;
  sampleRate: number;
  channels: number;
  /** 源精度：整数 PCM 源取实际位深；有损/浮点源记为 16 */
  bitDepth: number;
  /** 源音频编码名，如 vorbis / flac / aac */
  codec: string;
  /** 是否从视频中提取 */
  fromVideo: boolean;
  /** 保留区间（秒） */
  start: number;
  end: number;
}

export type ExportFormat = 'flac' | 'wav' | 'mp3' | 'ogg' | 'm4a';
export type BitDepthOption = 'auto' | 16 | 24;

export interface ExportOptions {
  format: ExportFormat;
  bitDepth: BitDepthOption;
}

export const FORMAT_INFO: Record<ExportFormat, { label: string; ext: string; lossless: boolean; mime: string }> = {
  flac: { label: 'FLAC（无损，推荐）', ext: 'flac', lossless: true, mime: 'audio/flac' },
  wav: { label: 'WAV（无损，体积大）', ext: 'wav', lossless: true, mime: 'audio/wav' },
  mp3: { label: 'MP3 320kbps（有损）', ext: 'mp3', lossless: false, mime: 'audio/mpeg' },
  ogg: { label: 'OGG Vorbis 高质量（有损）', ext: 'ogg', lossless: false, mime: 'audio/ogg' },
  m4a: { label: 'M4A AAC 256kbps（有损）', ext: 'm4a', lossless: false, mime: 'audio/mp4' },
};
