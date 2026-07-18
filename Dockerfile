# 家庭积分乐园 —— 单进程镜像（Node 服务端同时托管前端 + /api + SQLite）
# Node 24：内置 node:sqlite 已稳定，无需 --experimental-sqlite
FROM node:24-slim

WORKDIR /app

# 先装依赖（利用缓存）
COPY package.json ./
RUN npm install

# 拷贝源码并构建前端
COPY . .
RUN npm run build

# 数据库落盘目录（部署时挂载持久化卷到 /app/data）
ENV NODE_ENV=production
ENV PORT=8787
ENV DATA_DIR=/app/data
VOLUME ["/app/data"]

EXPOSE 8787
CMD ["npm", "start"]
