import { FORMAT_INFO, type Clip, type ExportOptions } from './types';

/** 导出时需要的片段信息（纯数据，便于单元测试） */
export type ClipSpec = Pick<Clip, 'start' | 'end' | 'sampleRate' | 'channels' | 'bitDepth'>;

export interface ExportPlan {
  /** 传给 ffmpeg 的参数，输入文件名按顺序为 inputNames[i] */
  args: string[];
  inputNames: string[];
  outputName: string;
  sampleRate: number;
  channels: number;
  /** 仅无损格式有意义 */
  bitDepth: number;
  /** 输出总时长（秒），用于计算进度 */
  duration: number;
}

const MP3_MAX_RATE = 48000;

/** 秒数转成 ffmpeg 可用的定点字符串，避免科学计数法 */
function sec(v: number): string {
  return Math.max(0, v).toFixed(6);
}

/**
 * 生成「逐段裁剪 → 统一采样率/声道 → 硬接拼合 → 编码」的 ffmpeg 命令。
 * - 采样率取各片段最大值（不降采样），MP3 上限 48kHz
 * - 任一片段为多声道则输出立体声，否则单声道
 * - 位深 auto：任一片段源精度 > 16bit 则 24bit，否则 16bit
 */
export function buildExportPlan(clips: ClipSpec[], opts: ExportOptions): ExportPlan {
  if (clips.length === 0) throw new Error('没有可导出的片段');
  for (const [i, c] of clips.entries()) {
    if (!(c.end > c.start)) throw new Error(`第 ${i + 1} 段的终点必须晚于起点`);
  }

  let sampleRate = Math.max(...clips.map((c) => c.sampleRate));
  if (opts.format === 'mp3') sampleRate = Math.min(sampleRate, MP3_MAX_RATE);
  const channels = clips.some((c) => c.channels >= 2) ? 2 : 1;
  const layout = channels === 2 ? 'stereo' : 'mono';
  const bitDepth =
    opts.bitDepth === 'auto' ? (clips.some((c) => c.bitDepth > 16) ? 24 : 16) : opts.bitDepth;

  const inputNames = clips.map((_, i) => `c${i}.flac`);
  const outputName = `out.${FORMAT_INFO[opts.format].ext}`;

  const chains = clips.map(
    (c, i) =>
      `[${i}:a]atrim=start=${sec(c.start)}:end=${sec(c.end)},asetpts=PTS-STARTPTS,` +
      `aresample=${sampleRate},aformat=sample_rates=${sampleRate}:channel_layouts=${layout}[a${i}]`,
  );
  const concatIn = clips.map((_, i) => `[a${i}]`).join('');
  const filter = `${chains.join(';')};${concatIn}concat=n=${clips.length}:v=0:a=1[out]`;

  const codecArgs: Record<ExportOptions['format'], string[]> = {
    flac: ['-c:a', 'flac', '-sample_fmt', bitDepth > 16 ? 's32' : 's16', '-compression_level', '5'],
    wav: ['-c:a', bitDepth > 16 ? 'pcm_s24le' : 'pcm_s16le'],
    mp3: ['-c:a', 'libmp3lame', '-b:a', '320k'],
    ogg: ['-c:a', 'libvorbis', '-q:a', '8'],
    m4a: ['-c:a', 'aac', '-b:a', '256k'],
  };

  const args = [
    ...inputNames.flatMap((n) => ['-i', n]),
    '-filter_complex',
    filter,
    '-map',
    '[out]',
    '-map_metadata',
    '-1',
    ...codecArgs[opts.format],
    ...(opts.format === 'flac' && bitDepth > 16 ? ['-bits_per_raw_sample', '24'] : []),
    '-y',
    outputName,
  ];

  const duration = clips.reduce((sum, c) => sum + (c.end - c.start), 0);
  return { args, inputNames, outputName, sampleRate, channels, bitDepth, duration };
}

/** 从 ffmpeg 日志行中解析当前处理到的时间（秒） */
export function parseProgressTime(line: string): number | null {
  const m = /time=\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(line);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}
