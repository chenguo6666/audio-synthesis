import { describe, expect, it } from 'vitest';
import { buildExportPlan, parseProgressTime, type ClipSpec } from './exportPlan';
import { formatTime, parseTime } from './time';

const ogg: ClipSpec = { start: 0, end: 20, sampleRate: 44100, channels: 2, bitDepth: 16 };

describe('buildExportPlan', () => {
  it('三段 OGG 硬接导出为 16bit FLAC', () => {
    const plan = buildExportPlan([ogg, { ...ogg, start: 1.5, end: 22 }, ogg], { format: 'flac', bitDepth: 'auto' });
    expect(plan.inputNames).toEqual(['c0.flac', 'c1.flac', 'c2.flac']);
    expect(plan.bitDepth).toBe(16);
    expect(plan.sampleRate).toBe(44100);
    expect(plan.channels).toBe(2);
    expect(plan.duration).toBeCloseTo(60.5);
    const filter = plan.args[plan.args.indexOf('-filter_complex') + 1];
    expect(filter).toContain('[1:a]atrim=start=1.500000:end=22.000000');
    expect(filter).toContain('[a0][a1][a2]concat=n=3:v=0:a=1[out]');
    expect(plan.args).toContain('s16');
    expect(plan.args.at(-1)).toBe('out.flac');
  });

  it('混合采样率/声道/位深时取最高规格', () => {
    const plan = buildExportPlan(
      [
        { start: 0, end: 5, sampleRate: 44100, channels: 1, bitDepth: 16 },
        { start: 0, end: 5, sampleRate: 96000, channels: 2, bitDepth: 24 },
      ],
      { format: 'wav', bitDepth: 'auto' },
    );
    expect(plan.sampleRate).toBe(96000);
    expect(plan.channels).toBe(2);
    expect(plan.bitDepth).toBe(24);
    expect(plan.args).toContain('pcm_s24le');
  });

  it('MP3 采样率上限 48kHz', () => {
    const plan = buildExportPlan([{ ...ogg, sampleRate: 96000 }], { format: 'mp3', bitDepth: 'auto' });
    expect(plan.sampleRate).toBe(48000);
    expect(plan.args).toContain('libmp3lame');
  });

  it('全部单声道时输出单声道', () => {
    const plan = buildExportPlan([{ ...ogg, channels: 1 }], { format: 'flac', bitDepth: 16 });
    expect(plan.channels).toBe(1);
    expect(plan.args.join(' ')).toContain('channel_layouts=mono');
  });

  it('非法区间与空列表报错', () => {
    expect(() => buildExportPlan([], { format: 'flac', bitDepth: 'auto' })).toThrow();
    expect(() => buildExportPlan([{ ...ogg, start: 5, end: 5 }], { format: 'flac', bitDepth: 'auto' })).toThrow(
      /第 1 段/,
    );
  });
});

describe('时间工具', () => {
  it('解析多种写法', () => {
    expect(parseTime('83.5')).toBe(83.5);
    expect(parseTime('1:23.5')).toBe(83.5);
    expect(parseTime('0:01:23.5')).toBe(83.5);
    expect(parseTime('1：05')).toBe(65);
    expect(parseTime('.5')).toBe(0.5);
    expect(parseTime('abc')).toBeNull();
    expect(parseTime('')).toBeNull();
  });

  it('格式化', () => {
    expect(formatTime(83.5)).toBe('1:23.500');
    expect(formatTime(3725.25, 2)).toBe('1:02:05.25');
    expect(formatTime(59.9996)).toBe('1:00.000');
  });

  it('解析 ffmpeg 进度日志', () => {
    expect(parseProgressTime('size=  1024kB time=00:01:02.50 bitrate=...')).toBeCloseTo(62.5);
    expect(parseProgressTime('Stream #0:0: Audio')).toBeNull();
  });
});
