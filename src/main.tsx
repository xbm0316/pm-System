import './styles.css'
import './astryx-workspace.css'
import { InternationalizationProvider } from '@astryxdesign/core/i18n'
import zhCN from '@astryxdesign/core/locales/zh-CN.generated.js'
import { Theme } from '@astryxdesign/core/theme'
import { neutralTheme } from '@astryxdesign/theme-neutral/built'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Theme theme={neutralTheme} mode="light">
      <InternationalizationProvider locale="zh-CN" messages={{ 'zh-CN': zhCN }}>
        <App />
      </InternationalizationProvider>
    </Theme>
  </StrictMode>
)
