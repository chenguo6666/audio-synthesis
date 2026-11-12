import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import './styles.css';

// 安卓端替换文件保存方式（按需加载，网页版不打包原生插件代码）
if (Capacitor.isNativePlatform()) {
  void import('./platform/native').then((m) => m.installNativePlatform());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
