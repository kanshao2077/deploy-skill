# 🚀 Deploy Skill

把 Coze / 秒哒导出的前端源码包，整理、上传并发布到 GitHub Pages。

Deploy Skill 是一个给 Codex 使用的部署技能。它面向 Vite / React 这类纯前端导出项目，目标是把一个下载下来的源码包，清理成可维护的 GitHub 仓库，并通过 GitHub Actions 发布到 GitHub Pages。

## 🤯 为什么做它

Coze / 秒哒导出的项目能跑，但离“能放到 GitHub 上长期使用”还差几步。

- ❌ 仓库名、README、构建脚本经常需要手动整理。
- ❌ GitHub Pages 需要正确的 `base` 路径和 workflow。
- ❌ 静态站和带后端/API 的项目很容易混淆。
- ❌ `.env`、`dist`、`node_modules` 这类文件一不小心就会被传上去。

这个 Skill 的目标不是搞复杂部署平台，而是把静态前端项目稳稳放到 GitHub Pages。

## 🎯 适合什么项目

- Coze / 秒哒导出的 Vite / React 前端项目。
- 有 `package.json`、`vite.config.ts`、`src/` 的静态网页工具。
- 适合通过 GitHub Pages 公开访问的小工具。
- 需要补 README、Pages workflow、`.gitignore`、构建脚本的源码包。

不适合：

- 依赖服务端 API 的完整后端项目。
- 必须运行数据库、定时任务、鉴权服务的应用。
- 需要私密环境变量才能工作的生产系统。

## 💡 它会做什么

- ✅ 检查 GitHub 登录状态和目标仓库是否存在。
- ✅ 解压并检查源码包结构。
- ✅ 修正 Vite 构建脚本和 GitHub Pages `base` 路径。
- ✅ 为 SPA 添加 GitHub Pages workflow 和 404 fallback。
- ✅ 清理不该上传的 `.env`、`dist`、`node_modules`。
- ✅ 写一份面向用户的简短 README。
- ✅ 创建 GitHub 仓库、推送代码、启用 Pages。
- ✅ 验证线上地址和静态资源是否可访问。

## ⚠️ 重要边界

GitHub Pages 只能托管静态文件。

如果项目依赖 Supabase、API 路由、服务端函数、定时任务或登录鉴权，这个 Skill 只能部署静态前端部分，并且必须明确说明哪些动态功能不会在 GitHub Pages 上工作。

## 🧩 仓库结构

```text
SKILL.md                         Skill 主说明
scripts/github-api-upload.mjs    Git push 失败时的 GitHub API 上传兜底脚本
agents/openai.yaml               Agent 配置
```

## 🛠️ 使用方式

把这个仓库作为 Codex Skill 安装或引用后，在需要部署 Coze / 秒哒前端源码包时调用它。

典型任务：

```text
把这个 Coze 导出的前端项目部署到 GitHub Pages
```

Skill 会优先走普通 Git 流程；如果 HTTPS push 失败，再使用 GitHub API 上传脚本兜底。

## ✅ 验证标准

完成一次部署前，至少要确认：

- 构建命令能跑通。
- `.env` 没有上传。
- GitHub Pages workflow 成功。
- Pages 地址返回 200。
- 页面引用的静态资源能正常加载。

## 🔐 安全提醒

不要把真实 `.env`、API Key、Token、账号密码提交到仓库。

这个 Skill 会检查常见敏感字段，但最终仍要以实际 diff 和 GitHub 仓库内容为准。
