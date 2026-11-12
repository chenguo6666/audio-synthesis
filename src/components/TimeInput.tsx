import { useEffect, useState } from 'react';
import { formatTime, parseTime } from '../lib/time';

interface Props {
  value: number;
  onCommit: (sec: number) => void;
}

/** 时间输入框：失焦或回车时提交，格式支持 83.5 / 1:23.5 */
export function TimeInput({ value, onCommit }: Props) {
  const [text, setText] = useState(formatTime(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(formatTime(value));
    setInvalid(false);
  }, [value]);

  const commit = () => {
    const sec = parseTime(text);
    if (sec === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onCommit(sec);
    setText(formatTime(value)); // 若父组件修正了数值，useEffect 会再同步
  };

  return (
    <input
      className={`time-input${invalid ? ' invalid' : ''}`}
      value={text}
      inputMode="decimal"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      aria-invalid={invalid}
    />
  );
}
