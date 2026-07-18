# 家庭积分乐园 · 复刻版

儿童积分打卡管理应用的 **1:1 复刻**（React + Vite + TypeScript + Tailwind + Recharts 前端，Node 内置 `node:sqlite` 真实落库）。

含 6 个视图：**首页大盘 / 任务打卡 / 奖品池 / 兑换记录 / 数据统计 / 家长面板**，全部可交互，数据持久化到磁盘 SQLite。

---

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | React 18 + Vite 5 + TypeScript + Tailwind CSS 3 + Recharts 2 |
| 后端 | Node.js `node:http`（零依赖）+ `node:sqlite`（内置，无需原生模块） |
| 数据 | SQLite 文件（`data/app.db`），normalized 表结构 |
| 运行 | `tsx` 直接跑 TS；生产单进程同时托管前端 + `/api` |

## 目录结构

```
family-points-paradise/
├── index.html
├── src/
│   ├── main.tsx / App.tsx
│   ├── types.ts               # 领域模型
│   ├── data/{seed,constants}.ts   # 种子数据 + 常量
│   ├── lib/date.ts            # 时区安全日期工具
│   ├── store/
│   │   ├── logic.ts           # 纯业务逻辑（可单测）
│   │   ├── logic.test.ts      # 13 项单测
│   │   ├── stats.ts           # 统计/图表选择器
│   │   └── StoreContext.tsx   # 前端状态 + API 读写
│   ├── components/            # Sidebar / TopBar / UI 基元 / 图标
│   └── views/                 # 6 个视图
├── server/
│   ├── db.ts                  # SQLite schema + load/save/seed
│   └── index.ts              # HTTP API + 生产托管前端
├── scripts/dev.mjs           # 并行跑前后端
├── Dockerfile
└── data/app.db               # 运行后自动生成（已 gitignore）
```

## 本地开发

```bash
npm install
npm run dev          # 同时启动后端(8787) + 前端(5173)，浏览器打开 http://localhost:5173
```

其它脚本：

```bash
npm run build        # 构建前端到 dist/
npm start            # 生产模式：单进程(默认 8787)同时托管前端 + /api
npm test             # 跑逻辑单测
npm run typecheck    # tsc 类型检查
```

## 关键说明

- **家长面板管理密码：`0000`**
- **「今天」锚定为 `2026-07-18`**（与原站一致，避免看板随系统日期漂移）；数据日期算法全部时区安全。
- 数据以「积分流水（ledger）」为单一事实来源，成员总分 = 其所有流水之和。
- 打卡 / 兑换均为**两段式**：孩子提交 → 家长在家长面板确认后才加/扣分。

---

## 部署到腾讯云服务器

### 方式一：直接用 Node 跑（推荐，最简单）

服务器需 **Node ≥ 24**（内置 `node:sqlite` 已稳定，无需 flag；Node 22/23 需加 `--experimental-sqlite`）。

```bash
# 1. 上传代码到服务器（git clone 或 scp）
cd family-points-paradise

# 2. 安装依赖并构建前端
npm install
npm run build

# 3. 启动（单进程托管前端 + API + SQLite）
PORT=8787 DATA_DIR=/var/lib/family-points npm start
```

用 **pm2** 常驻 + 开机自启：

```bash
npm i -g pm2
PORT=8787 DATA_DIR=/var/lib/family-points pm2 start "npm start" --name family-points
pm2 save && pm2 startup
```

### 方式二：Docker

```bash
docker build -t family-points .
docker run -d --name family-points \
  -p 8787:8787 \
  -v /var/lib/family-points:/app/data \    # 持久化数据库到宿主机
  family-points
```

### Nginx 反代（HTTPS）

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/cert.key;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> 记得在腾讯云安全组放行对外端口（如 443 / 8787）。

### 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `8787` | 服务监听端口 |
| `DATA_DIR` | `./data` | SQLite 数据库目录（**部署时指向持久化卷**） |
| `DB_PATH` | `$DATA_DIR/app.db` | 数据库文件完整路径（可选） |
| `NODE_ENV` | — | 设为 `production` 时服务端托管构建后的前端 |

## 数据管理

- 首次启动若数据库为空，自动用种子数据初始化。
- `POST /api/reset` 可一键恢复初始数据（前端家长面板未暴露，按需调用）。
- 备份/迁移直接拷贝 `data/app.db`（连同 `-wal` / `-shm`）即可。
