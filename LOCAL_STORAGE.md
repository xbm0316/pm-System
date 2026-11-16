# 浏览器本地附件存储

附件由浏览器的 File System Access API 保存到用户主动选择的本地文件夹，页面不再依赖 Node 文件服务，也不需要启动 `npm run server`。

第一次上传时，Chrome 或 Edge 会弹出文件夹选择框。选择例如 `D:\jawcat-files` 后，项目会自动建立：

```text
D:\jawcat-files\uploads\空间ID\业务类型\业务ID\文件ID.扩展名
```

附件元数据、浏览器目录授权和用于浏览器预览的本地索引保存在当前网站的 IndexedDB 中；文件本体同时写入用户选择的文件夹。刷新页面后，Service Worker 会根据附件 ID 恢复预览和下载。

限制：用户必须主动授权文件夹；清除浏览器站点数据、换浏览器或换域名后需要重新选择文件夹。Chrome/Edge 桌面版支持最好。
