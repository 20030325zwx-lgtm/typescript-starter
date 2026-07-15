# Learn App PC 管理端

Vue 3 + TypeScript + Vite 实现的只读运营管理后台。

## 启动

1. 在后端 `.env` 启用并配置 `ADMIN_*` 环境变量。
2. 将管理端域名加入后端 `CORS_ORIGINS`。
3. 复制 `.env.example` 为 `.env.local`，按需修改 API 地址。

```powershell
npm install
npm run dev
```

生产构建：

```powershell
npm run build
```

完整设计和接口说明见 `../../../docs/16-pc-admin-design.md`。
