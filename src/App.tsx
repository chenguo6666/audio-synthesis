import { useCallback, useRef, useState } from 'react';
import { ClipEditor } from './components/ClipEditor';
import { ExportPanel } from './components/ExportPanel';
import { isFFmpegLoaded } from './lib/ffmpeg';
import { importMedia } from './lib/media';
import type { Clip } from './lib/types';

interface Job {
  key: number;
  name: string;
  progress: number;
  status: 'waiting' | 'running' | 'error';
  message?: string;
}

let jobSeq = 0;

export default function App() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [engineLoading, setEngineLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateJob = (key: number, patch: Partial<Job>) =>
    setJobs((js) => js.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  const addFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const newJobs: Job[] = files.map((f) => ({ key: ++jobSeq, name: f.name, progress: 0, status: 'waiting' }));
    setJobs((js) => [...js, ...newJobs]);
    if (!isFFmpegLoaded()) setEngineLoading(true);

    // 逐个导入（ffmpeg 本身也是串行的），保证片段顺序与选择顺序一致
    for (const [i, file] of files.entries()) {
      const job = newJobs[i];
      updateJob(job.key, { status: 'running' });
      try {
        const media = await importMedia(file, (p) => updateJob(job.key, { progress: p }));
        setEngineLoading(false);
        setClips((cs) => [...cs, { ...media, start: 0, end: media.duration }]);
        setJobs((js) => js.filter((j) => j.key !== job.key));
      } catch (e) {
        setEngineLoading(false);
        updateJob(job.key, { status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    }
  }, []);

  const patchClip = (id: string, patch: Partial<Clip>) =>
    setClips((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const moveClip = (index: number, delta: -1 | 1) =>
    setClips((cs) => {
      const to = index + delta;
      if (to < 0 || to >= cs.length) return cs;
      const next = [...cs];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  const removeClip = (id: string) =>
    setClips((cs) => {
      const target = cs.find((c) => c.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return cs.filter((c) => c.id !== id);
    });

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <img src="./icon.svg" alt="" width={32} height={32} />
          <div>
            <h1>音频剪辑合成</h1>
            <p className="muted">提取 · 裁剪 · 拼接 · 无损导出</p>
          </div>
        </div>
        <span className="badge" title="所有处理都在本机完成，文件不会上传到任何服务器">
          🔒 纯本地处理
        </span>
      </header>

      <section
        className={`panel drop${dragOver ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void addFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <p className="drop-title">拖入音频或视频文件，或</p>
        <button className="btn primary" onClick={() => inputRef.current?.click()}>
          选择文件
        </button>
        <p className="muted small">
          支持 MP3 / FLAC / WAV / OGG / M4A / AAC / OPUS，以及 MP4 / MKV / MOV / WEBM 等视频（自动提取音轨）
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="audio/*,video/*,.flac,.ogg,.opus,.m4a,.mkv,.ape,.wma"
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            void addFiles(files);
          }}
        />
      </section>

      {(jobs.length > 0 || engineLoading) && (
        <section className="panel jobs">
          {engineLoading && <p className="muted">首次使用需加载处理引擎（约 31 MB），请稍候…</p>}
          {jobs.map((j) => (
            <div key={j.key} className={`job ${j.status}`}>
              <div className="job-row">
                <span className="job-name">{j.name}</span>
                <span className="muted">
                  {j.status === 'waiting' && '等待中'}
                  {j.status === 'running' && `提取中 ${Math.round(j.progress * 100)}%`}
                  {j.status === 'error' && '失败'}
                </span>
                {j.status === 'error' && (
                  <button
                    className="icon-btn"
                    aria-label="关闭"
                    onClick={() => setJobs((js) => js.filter((x) => x.key !== j.key))}
                  >
                    ✕
                  </button>
                )}
              </div>
              {j.status === 'error' ? (
                <p className="error">{j.message}</p>
              ) : (
                <div className="progress">
                  <div style={{ width: `${Math.round(j.progress * 100)}%` }} />
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {clips.length > 0 && (
        <>
          <div className="clips">
            {clips.map((clip, i) => (
              <ClipEditor
                key={clip.id}
                clip={clip}
                index={i}
                total={clips.length}
                onChange={(p) => patchClip(clip.id, p)}
                onMove={(d) => moveClip(i, d)}
                onRemove={() => removeClip(clip.id)}
              />
            ))}
          </div>
          <ExportPanel clips={clips} />
        </>
      )}

      <footer className="foot muted small">
        开源项目 ·{' '}
        <a href="https://github.com/chenguo6666/audio-synthesis" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  );
}
