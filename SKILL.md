---
name: deploy
description: Deploy Coze/Miaoda exported Vite/React frontend source packages to GitHub and GitHub Pages. Use when the user asks to upload a downloaded Coze source tarball, publish a static frontend app to GitHub, write a simple README, configure GitHub Pages, or repeat the "见白 / Rewrite Studio / PixelPrompt" deployment flow.
---

# Deploy

## Scope

Use this skill for Coze/Miaoda exported frontend projects, usually `.tar.gz` packages containing a `projects/` folder with Vite, React, TypeScript, `package.json`, `vite.config.ts`, `.env`, and generated README files.

Do not treat this as a generic backend deployment workflow. GitHub Pages can host static frontend output only. If the project needs Supabase, API keys, server routes, scheduled jobs, or auth, deploy the static frontend and clearly state which dynamic features will not work without environment variables or backend hosting.

## Default Outcome

Create a public GitHub repository under the authenticated GitHub account, push the cleaned source, enable GitHub Pages with GitHub Actions, and verify the live URL.

Default repository name:

- Derive a lowercase hyphen-case name from the app or archive name.
- Use `pixel-prompt` style names, not Chinese folder names.
- Check remote availability before creating the repo.

Default Pages URL:

```text
https://<github-user>.github.io/<repo-name>/
```

## Preflight

1. Confirm GitHub CLI is installed and authenticated.
2. Inspect the archive before extracting.
3. Check whether the target repo already exists.
4. Extract into a clean project folder under the current workspace.
5. Read only deployment-critical files first:
   - `package.json`
   - `vite.config.ts`
   - `src/main.tsx`
   - `src/App.tsx`
   - `.env`
   - `.gitignore`
   - existing `README*`
   - project docs if needed to understand user-facing purpose

Prefer these checks:

```bash
tar -tzf "/path/to/app.tar.gz" | sed -n '1,140p'
gh auth status
gh repo view <owner>/<repo> --json nameWithOwner,url,visibility,defaultBranchRef
```

## Required Edits

Keep edits narrow. Do not redesign, refactor, or add product features.

### `package.json`

Verify `build` actually builds. Some Coze exports contain placeholder scripts such as:

```json
"build": "echo 'Do not use this command, only use lint to check'"
```

Replace placeholders with real Vite scripts:

```json
"dev": "vite --port 5000 --host",
"build": "vite build"
```

Do not add new dependencies for deployment unless the existing project cannot build without them.

### `vite.config.ts`

Add a GitHub Pages base path controlled by an environment variable:

```ts
const isGitHubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  base: isGitHubPages ? '/<repo-name>/' : '/',
  // existing config...
});
```

Preserve existing plugins and aliases.

### Router

For `BrowserRouter`, add the Vite base path:

```tsx
<BrowserRouter basename={import.meta.env.BASE_URL}>
```

For aliased imports:

```tsx
<Router basename={import.meta.env.BASE_URL}>
```

If the app already uses `HashRouter`, usually do not change routing.

### `.gitignore`

Ensure these are ignored:

```gitignore
.env
node_modules
dist
package-lock.json
```

Add `.env.example` with non-secret placeholders or app IDs only. Do not commit real `.env`.

### GitHub Pages Workflow

Create `.github/workflows/pages.yml` with current GitHub Actions versions:

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: github-pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Setup Node
        uses: actions/setup-node@v6
        with:
          node-version: 24

      - name: Install dependencies
        run: npm install --no-package-lock

      - name: Build
        env:
          GITHUB_PAGES: 'true'
        run: npm run build

      - name: Add SPA fallback
        run: cp dist/index.html dist/404.html

      - name: Configure Pages
        uses: actions/configure-pages@v6

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v5
```

Delete irrelevant generated workflows such as keepalive checks against `/health` for static sites.

### README

Replace generated boilerplate with a short plain-language README. Include:

- What the tool does
- Online URL
- Main user-facing features
- Data/storage warning
- Local run commands
- Build command
- GitHub Pages deployment note
- Original Coze/Miaoda source link if present

Write directly, not like marketing copy.

## Static Asset Checks

After building, search for unresolved absolute assets such as:

```text
/miaoda-uploads/...
```

If the referenced file was not exported and the style can be replaced safely, prefer a CSS fallback over leaving a live 404. Example for pixel/dither backgrounds:

```css
background-color: #f0f0f0;
background-image: radial-gradient(#000000 1px, transparent 1px);
background-size: 4px 4px;
```

Do not invent image assets unless the user asked for visual redesign.

## Validation Before Upload

Run:

```bash
npm install --no-package-lock
GITHUB_PAGES=true npm run build
```

Then check:

```bash
rg -n 'href="/<repo-name>/|src="/<repo-name>/|miaoda-uploads' dist src public index.html
rg -n -i '(secret|password|bearer|gho_|sk-|AKIA|api[_-]?key|private[_-]?key|dsn)' -g '!node_modules/**' -g '!dist/**' .
git check-ignore -v .env node_modules dist package-lock.json || true
```

Do not run `npm audit fix --force` during deployment. Report audit warnings as residual risk unless the user explicitly asks to fix dependencies.

## Publish

Use normal Git first:

```bash
git init -b main
git config user.name <github-login>
git config user.email <github-login>@users.noreply.github.com
git add .
git commit -m 'Initial GitHub Pages deployment'
gh repo create <owner>/<repo> --public --description '<short description>' --source . --remote origin --push
```

Enable Pages:

```bash
gh api --method POST repos/<owner>/<repo>/pages -f build_type=workflow \
  || gh api --method GET repos/<owner>/<repo>/pages
```

Watch the workflow:

```bash
gh run list --repo <owner>/<repo> --workflow pages.yml --limit 5
gh run watch <run-id> --repo <owner>/<repo> --exit-status
```

## Git Push Fallback

If the repo was created but `git push` fails because of GitHub HTTPS transport errors, do not keep retrying blindly. Use the bundled fallback script after committing locally:

```bash
node /Users/a1/.codex/skills/deploy/scripts/github-api-upload.mjs \
  --repo <owner>/<repo> \
  --branch main \
  --message 'Initial GitHub Pages deployment'
```

Then fetch and align local Git:

```bash
git fetch origin
git rebase origin/main
git branch --set-upstream-to=origin/main main
```

The script uploads tracked Git files only. It does not upload ignored `.env`, `dist`, or `node_modules`.

## Final Verification

Verify all of these before saying it is done:

```bash
curl -I --max-time 60 https://<owner>.github.io/<repo>/
html=$(curl -L --max-time 30 -s https://<owner>.github.io/<repo>/)
printf '%s' "$html" | rg -o '/<repo>/assets/[^" ]+' | sort -u | while read asset; do
  curl -I --max-time 20 -s "https://<owner>.github.io$asset" | sed -n '1p'
  echo "$asset"
done
gh api repos/<owner>/<repo>/contents/.env --jq '.path' 2>/dev/null || echo '.env not uploaded'
git status -sb
```

If the first Pages request times out right after deployment, retry once with a longer timeout before declaring failure. GitHub Pages propagation can lag briefly.

## Final Response Format

Use the user's preferred direct format:

```text
改了什么：
为什么这么改：
涉及哪些文件：
怎么验证：
验证结果：
还有什么风险或未完成：
```

Keep it short. Include the GitHub repo URL and the Pages URL.
