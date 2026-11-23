# 项目规范

## 适用范围

- Astryx 是本项目统一的设计系统和 UI 组件来源。规范覆盖登录页、首页、所有工作区，以及导航、表单、卡片、弹窗、提醒和各类页面状态。
- 所有新建和修改的 UI 都遵循此规范。迁移现有页面时，逐步把页面、共享组件和全局样式纳入同一套设计系统。

## 组件与样式

- 先查 Astryx 官方文档和组件目录。有对应的基础组件时，从已安装的 Astryx 包导入。有适合的官方模板时，用它搭建页面结构，再接入项目的数据和操作。
- Astryx 缺少完整的业务组件时，使用官方基础组件组合。自定义 CSS 用在布局、响应式和业务展示，颜色、文字、间距、圆角、边框和阴影使用 Astryx 的设计变量。
- 全站使用入口统一配置的 Astryx 官方 Neutral 暗色主题，组件文案使用简体中文。共用的主题和组件定制集中维护。新增 UI 禁止引入第二套组件库、重新实现已有的 Astryx 基础组件，或给页面单独定义一套主题样式。
- 可打开详情或编辑的业务卡片使用 `ClickableCard`，卡片中的次级按钮独立操作。日期、日期范围和日期时间分别使用 `DateInput`、`DateRangeInput` 和 `DateTimeInput`；允许只选起止一端的筛选使用两个 `DateInput`。
- 迁移时保留现有业务行为、数据结构和路由。现有的交互规格继续适用，例如待办分组、卡片排序，以及关闭详情后回到提醒抽屉的原页签。

## 接入与验证

- 按官方文档先完成 React 19 和根组件的 Astryx 主题接入。锁定配套的 Astryx Core、主题和 CLI 版本。处理 `src/styles.css` 中的全局重置和旧主题样式，确保 Astryx 的样式在迁移页面正常应用。
- 用已安装的 Astryx CLI 查组件用法和模板，例如 `npx @astryxdesign/cli component Button` 和 `npx @astryxdesign/cli template --list`。模板含 `stylex.create()` 时，按官方 Vite 文档接入 StyleX 编译。
- 前端迁移后运行 `npm run build`，并在浏览器里验证涉及的交互、窄屏布局、键盘可用性和适用的空白、加载及错误状态。

[Astryx 官方组件文档](https://github.com/meta/astryx/blob/main/packages/core/README.md) · [样式接入](https://astryx.atmeta.com/docs/styling-overview) · [渐进迁移](https://astryx.atmeta.com/docs/migration)

## Git 工作流

- 后续迭代默认在 `main` 上开发。用户要求推送时，检查本地提交和远程状态后直接推送到 `origin/main`。用户明确指定其他分支时，按指定分支操作。
