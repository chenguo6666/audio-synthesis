import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { type Region } from 'wavesurfer.js/plugins/regions';
import type { Clip } from '../lib/types';
import { formatTime } from '../lib/time';
import { TimeInput } from './TimeInput';

interface Props {
  clip: Clip;
  index: number;
  total: number;
  onChange: (patch: Partial<Clip>) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}

/** 全局只允许一个片段在播放 */
let activePlayer: WaveSurfer | null = null;

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const MIN_LEN = 0.05;

export function ClipEditor({ clip, index, total, onChange, onMove, onRemove }: Props) {
  const waveRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionRef = useRef<Region | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  // 回调里需要最新值，避免把它们放进 effect 依赖导致重建波形
  const latest = useRef({ clip, onChange });
  latest.current = { clip, onChange };

  useEffect(() => {
    if (!waveRef.current) return;
    const regions = RegionsPlugin.create();
    const ws = WaveSurfer.create({
      container: waveRef.current,
      url: clip.url,
      height: 88,
      waveColor: cssVar('--wave') || '#94a3b8',
      progressColor: cssVar('--wave-progress') || '#2563eb',
      cursorColor: cssVar('--accent') || '#2563eb',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      dragToSeek: true,
      plugins: [regions],
    });
    wsRef.current = ws;

    ws.on('decode', (duration) => {
      const { clip: c, onChange: change } = latest.current;
      // 以实际解码时长为准修正元数据时长
      const end = c.end > 0 && c.end <= duration ? c.end : duration;
      const start = Math.min(c.start, Math.max(0, end - MIN_LEN));
      if (duration !== c.duration || end !== c.end || start !== c.start) {
        change({ duration, start, end });
      }
      regions.clearRegions();
      const region = regions.addRegion({
        start,
        end,
        color: cssVar('--region') || 'rgba(37,99,235,0.15)',
        drag: true,
        resize: true,
        minLength: MIN_LEN,
      });
      region.on('update-end', () => {
        latest.current.onChange({ start: region.start, end: region.end });
      });
      regionRef.current = region;
      setReady(true);
    });
    ws.on('timeupdate', (t) => setCurrent(t));
    ws.on('play', () => {
      if (activePlayer && activePlayer !== ws) activePlayer.pause();
      activePlayer = ws;
      setPlaying(true);
    });
    ws.on('pause', () => setPlaying(false));
    ws.on('finish', () => setPlaying(false));

    return () => {
      if (activePlayer === ws) activePlayer = null;
      regionRef.current = null;
      ws.destroy();
    };
  }, [clip.url]);

  // 输入框修改起止点时同步到波形上的选区
  useEffect(() => {
    const r = regionRef.current;
    if (r && (Math.abs(r.start - clip.start) > 1e-4 || Math.abs(r.end - clip.end) > 1e-4)) {
      r.setOptions({ start: clip.start, end: clip.end });
    }
  }, [clip.start, clip.end]);

  const ws = wsRef.current;
  const keep = Math.max(0, clip.end - clip.start);

  const setStart = (v: number) => {
    const start = Math.min(Math.max(0, v), clip.end - MIN_LEN);
    onChange({ start });
  };
  const setEnd = (v: number) => {
    const end = Math.max(Math.min(clip.duration, v), clip.start + MIN_LEN);
    onChange({ end });
  };

  return (
    <article className="clip">
      <header className="clip-head">
        <span className="clip-index">{index + 1}</span>
        <div className="clip-title">
          <div className="clip-name" title={clip.name}>
            {clip.name}
          </div>
          <div className="clip-meta">
            {clip.fromVideo && <span className="tag">视频提取</span>}
            <span>{clip.codec}</span>
            <span>{(clip.sampleRate / 1000).toFixed(1)} kHz</span>
            <span>{clip.channels === 1 ? '单声道' : '立体声'}</span>
            <span>总长 {formatTime(clip.duration, 2)}</span>
          </div>
        </div>
        <div className="clip-actions">
          <button className="icon-btn" onClick={() => onMove(-1)} disabled={index === 0} title="上移" aria-label="上移">
            ↑
          </button>
          <button
            className="icon-btn"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            title="下移"
            aria-label="下移"
          >
            ↓
          </button>
          <button className="icon-btn danger" onClick={onRemove} title="删除" aria-label="删除">
            ✕
          </button>
        </div>
      </header>

      <div className="wave" ref={waveRef}>
        {!ready && <div className="wave-loading">正在绘制波形…</div>}
      </div>

      <div className="clip-controls">
        <div className="play-group">
          <button className="btn" disabled={!ready} onClick={() => ws?.playPause()}>
            {playing ? '⏸ 暂停' : '▶ 播放'}
          </button>
          <button className="btn" disabled={!ready} onClick={() => ws?.play(clip.start, clip.end)}>
            ▶ 试听保留部分
          </button>
          <button className="btn" disabled={!ready} onClick={() => ws?.play(Math.max(clip.start, clip.end - 3), clip.end)}>
            听结尾 3 秒
          </button>
          <span className="now">{formatTime(current, 2)}</span>
        </div>

        <div className="range-group">
          <div className="field">
            <span>起点</span>
            <TimeInput value={clip.start} onCommit={setStart} />
            <button className="btn small" disabled={!ready} onClick={() => setStart(current)}>
              设为当前
            </button>
          </div>
          <div className="field">
            <span>终点</span>
            <TimeInput value={clip.end} onCommit={setEnd} />
            <button className="btn small" disabled={!ready} onClick={() => setEnd(current)}>
              设为当前
            </button>
          </div>
          <span className="keep">保留 {formatTime(keep, 2)}</span>
        </div>
      </div>
    </article>
  );
}
