import { mountFile, safeDelete, unmountDir, withFFmpeg } from './ffmpeg';
import { parseProgressTime } from './exportPlan';
import type { Clip } from './types';

/** 常见音乐平台的加密/专有格式：无法当作普通音频解码 */
const ENCRYPTED_EXT = /\.(kgm|kgma|vpr|ncm|qmc\w*|mflac\w*|mgg\w*|kwm|tm\d|bkc\w*)(\.\w+)?$/i;
const ENCRYPTED_MAGIC: Array<{ name: string; bytes: number[] }> = [
  { name: '酷狗 KGM', bytes: [0x7c, 0xd5, 0x32, 0xeb] },
  { name: '酷狗 VPR', bytes: [0x05, 0x28, 0xbc, 0x96] },
  { name: '网易云 NCM', bytes: [0x43, 0x54, 0x45, 0x4e, 0x46, 0x44, 0x41, 0x4d] },
];

export class ImportError extends Error {}

/** 检测平台加密格式，返回格式名；普通文件返回 null */
export async function detectEncrypted(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  for (const sig of ENCRYPTED_MAGIC) {
    if (sig.bytes.every((b, i) => head[i] === b)) return sig.name;
  }
  if (ENCRYPTED_EXT.test(file.name)) return '音乐平台加密格式';
  return null;
}

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  sample_rate?: string;
  channels?: number;
  sample_fmt?: string;
  bits_per_raw_sample?: string;
  bits_per_sample?: number;
}
interface ProbeResult {
  streams?: ProbeStream[];
  format?: { duration?: string; format_name?: string };
}

const VIDEO_CODEC_EXCLUDE = /^(mjpeg|png|bmp|gif|webp)$/; // 音乐文件里的封面图不算视频

function sourceBitDepth(s: ProbeStream): number {
  const raw = Number(s.bits_per_raw_sample || s.bits_per_sample || 0);
  if (s.sample_fmt?.startsWith('flt') || s.sample_fmt?.startsWith('dbl')) return 16; // 有损/浮点源
  if (raw > 0) return raw;
  if (s.sample_fmt?.startsWith('s32')) return 24;
  return 16;
}

let seq = 0;

/**
 * 导入任意音视频文件：探测音轨 → 提取第一条音轨 → 转成无损 FLAC 中间文件。
 * 浮点源（MP3/AAC/Vorbis/Opus 等有损解码结果）以 24bit 保存，避免中间环节再量化损失。
 */
export async function importMedia(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<Omit<Clip, 'start' | 'end'>> {
  const encrypted = await detectEncrypted(file);
  if (encrypted) {
    throw new ImportError(
      `「${file.name}」是${encrypted}加密文件，并非普通音频。请在对应音乐客户端中导出为普通格式后再导入。`,
    );
  }

  const id = `clip${++seq}`;
  const dir = `/in_${id}`;
  const probeOut = `${id}.json`;
  const out = `${id}.flac`;
  let totalDuration = 0;

  return withFFmpeg(
    async (ff) => {
      const input = await mountFile(ff, file, dir);
      try {
        await ff.ffprobe([
          '-v', 'error',
          '-show_entries',
          'stream=codec_type,codec_name,sample_rate,channels,sample_fmt,bits_per_raw_sample,bits_per_sample:format=duration,format_name',
          '-of', 'json',
          input,
          '-o', probeOut,
        ]);
        let probe: ProbeResult = {};
        try {
          probe = JSON.parse(String(await ff.readFile(probeOut, 'utf8')));
        } catch {
          throw new ImportError(`无法识别「${file.name}」的格式，文件可能已损坏或不是音视频文件。`);
        }
        await safeDelete(ff, probeOut);

        const streams = probe.streams ?? [];
        const audio = streams.find((s) => s.codec_type === 'audio');
        if (!audio) throw new ImportError(`「${file.name}」中没有找到音轨。`);
        const fromVideo = streams.some(
          (s) => s.codec_type === 'video' && !VIDEO_CODEC_EXCLUDE.test(s.codec_name ?? ''),
        );
        totalDuration = Number(probe.format?.duration) || 0;

        const srcChannels = audio.channels ?? 2;
        const isFloat = /^(flt|dbl)/.test(audio.sample_fmt ?? '');
        const bitDepth = sourceBitDepth(audio);
        const code = await ff.exec([
          '-i', input,
          '-map', '0:a:0',
          '-vn', '-sn', '-dn',
          '-map_metadata', '-1',
          ...(srcChannels > 2 ? ['-ac', '2'] : []), // 多声道（如 5.1）下混为立体声
          '-c:a', 'flac',
          '-compression_level', '0',
          '-sample_fmt', isFloat || bitDepth > 16 ? 's32' : 's16',
          ...(isFloat || bitDepth > 16 ? ['-bits_per_raw_sample', '24'] : []),
          '-y', out,
        ]);
        if (code !== 0) throw new ImportError(`提取「${file.name}」的音频失败（ffmpeg 退出码 ${code}）。`);

        const data = (await ff.readFile(out)) as Uint8Array;
        await safeDelete(ff, out);
        const blob = new Blob([data as BlobPart], { type: 'audio/flac' });
        return {
          id,
          name: file.name,
          blob,
          url: URL.createObjectURL(blob),
          duration: totalDuration,
          sampleRate: Number(audio.sample_rate) || 44100,
          channels: Math.min(srcChannels, 2),
          bitDepth,
          codec: audio.codec_name ?? 'unknown',
          fromVideo,
        };
      } finally {
        await unmountDir(ff, dir);
      }
    },
    (line) => {
      const t = parseProgressTime(line);
      if (t !== null && totalDuration > 0) onProgress?.(Math.min(1, t / totalDuration));
    },
  );
}
