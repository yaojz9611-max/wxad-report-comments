# 数据处理工具

一个简单易用的前端数据处理工具，支持 TXT 和 Excel 文件的处理。

## 功能特性

### 模块一：原始数据处理
- 上传 TXT 文件
- 自动解析制表符分隔的数据
- 按 `raw_comments` 列中的 `$` 符号拆分数据行
- 导出为 Excel (.xlsx) 格式

### 模块二：标注后数据处理
- 上传 Excel 文件
- 按 `sentiment_tag` 和 `opinion` 分组
- 合并每组的 `raw_comments`（用 `$` 连接）
- 过滤 `tf` 总和为 0 的组
- 将 `tf` 字段重命名为 `done_time`
- 导出为 CSV 格式（支持中文）

## 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

浏览器会自动打开 http://localhost:5173

### 构建生产版本
```bash
npm run build
```

构建后的文件在 `dist` 目录中，可以部署到任何静态文件服务器。

## 使用说明

### 原始数据处理
1. 点击"原始数据处理"标签
2. 上传 TXT 文件（支持拖拽）
3. 点击"开始处理"
4. 处理完成后下载 Excel 文件

**输入格式要求：**
- TXT 文件，制表符分隔
- 第一行为列名
- 包含 `raw_comments` 列

### 标注后数据处理
1. 点击"标注后数据处理"标签
2. 上传 Excel 文件（支持拖拽）
3. 点击"开始处理"
4. 处理完成后下载 CSV 文件

**输入格式要求：**
- Excel 文件 (.xlsx 或 .xls)
- 包含以下列：`sentiment_tag`, `opinion`, `tf`, `raw_comments`

## 技术栈

- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **xlsx** - Excel 文件处理

## 安全说明

所有数据处理均在浏览器本地完成，不会上传到任何服务器，您的数据完全安全。

## 浏览器兼容性

支持所有现代浏览器（Chrome、Firefox、Safari、Edge）
