import { useEffect, useState } from 'react';
import { exportClips } from '../lib/exporter';
import { saveBlob, sanitizeFilename } from '../lib/save';
import { formatBytes, formatTime } from '../lib/time';
import { FORMAT_INFO, type BitDepthOption, type Clip, type ExportFormat } from '../lib/types';

interface Props {
  clips: Clip[];
}

interface Result {
  url: string;
  blob: Blob;
  filename: string;
  summary: string;
}

export function ExportPanel({ clips }: Props) {
  const [format, setFormat] = useState<ExportFormat>('flac');
  const [bitDepth, setBitDepth] = useState<BitDepthOption>('auto');
  const [name, setName] = useState('合成音频');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [savedMsg, setSavedMsg] = useState('');

  const info = FORMAT_INFO[format];
  const totalKeep = clips.reduce((s, c) => s + Math.max(0, c.end - c.start), 0);

  // 片段或参数变化后，旧的导出结果失效
  useEffect(() => {
    setResult((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return null;
    });
    setSavedMsg('');
  }, [clips, format, bitDepth]);

  const run = async () => {
    setBusy(true);
    setError('');
    setProgress(0);
    setSavedMsg('');
    try {
      const { blob, plan } = await exportClips(clips, { format, bitDepth }, setProgress);
      const filename = `${sanitizeFilename(name)}.${info.ext}`;
      const depth = info.lossless ? ` · ${plan.bitDepth}bit` : '';
      setResult({
        url: URL.createObjectURL(blob),
        blob,
        filename,
        summary: `${formatTime(plan.duration, 2)} · ${(plan.sampleRate / 1000).toFixed(1)} kHz · ${
          plan.channels === 2 ? '立体声' : '单声道'
        }${depth} · ${formatBytes(blob.size)}`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!result) return;
    try {
      const where = await saveBlob(result.blob, result.filename);
      setSavedMsg(where ? `已保存到：${where}` : '已开始下载');
    } catch (e) {
      setSavedMsg(`保存失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <section className="panel export">
      <h2>导出</h2>
      <div className="export-grid">
        <div className="field">
          <span>格式</span>
          <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)} disabled={busy}>
            {(Object.keys(FORMAT_INFO) as ExportFormat[]).map((f) => (
              <option key={f} value={f}>
                {FORMAT_INFO[f].label}
              </option>
            ))}
          </select>
        </div>
        {info.lossless && (
          <div className="field">
            <span>位深</span>
            <select
              value={String(bitDepth)}
              onChange={(e) => setBitDepth(e.target.value === 'auto' ? 'auto' : (Number(e.target.value) as 16 | 24))}
              disabled={busy}
            >
              <option value="auto">自动（跟随源）</option>
              <option value="16">16 bit</option>
              <option value="24">24 bit</option>
            </select>
          </div>
        )}
        <div className="field grow">
          <span>文件名</span>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
          <span className="ext">.{info.ext}</span>
        </div>
      </div>

      <p className="hint">
        共 {clips.length} 段，合计 {formatTime(totalKeep, 2)}，按列表顺序直接拼接。
        {info.lossless
          ? '无损格式：对解码后的音频不做任何压缩损失。'
          : '有损格式：体积小，但会再压缩一次。'}
      </p>

      <div className="export-actions">
        <button className="btn primary" onClick={run} disabled={busy || clips.length === 0}>
          {busy ? `正在导出… ${Math.round(progress * 100)}%` : '开始合成并导出'}
        </button>
      </div>
      {busy && (
        <div className="progress">
          <div style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result">
          <div className="result-head">
            <strong>{result.filename}</strong>
            <span className="muted">{result.summary}</span>
          </div>
          <audio controls src={result.url} />
          <div className="export-actions">
            <button className="btn primary" onClick={save}>
              保存文件
            </button>
            {savedMsg && <span className="muted">{savedMsg}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
