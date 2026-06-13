#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

function usage() {
  console.log(`Usage:
  node github-api-upload.mjs --repo owner/name [--branch main] [--message "Initial GitHub Pages deployment"]

Uploads the current git repository's tracked files to GitHub through the REST API.
Use only as a fallback when the GitHub repo exists but git push fails due to HTTPS transport errors.`);
}

function valueAfter(flag, fallback = undefined) {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  return args[index + 1];
}

if (args.includes('--help') || args.includes('-h')) {
  usage();
  process.exit(0);
}

const repoArg = valueAfter('--repo');
const branch = valueAfter('--branch', 'main');
const message = valueAfter('--message', 'Initial GitHub Pages deployment');

if (!repoArg || !repoArg.includes('/')) {
  usage();
  process.exit(2);
}

const [owner, repo] = repoArg.split('/');

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${command} failed`).trim());
  }
  return result.stdout.trim();
}

function getToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  return run('gh', ['auth', 'token']);
}

const token = getToken();
const api = 'https://api.github.com';

async function gh(path, options = {}) {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }

  if (!response.ok) {
    const error = new Error(`${options.method || 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body).slice(0, 800)}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

async function ghMaybe(path, options = {}) {
  try {
    return await gh(path, options);
  } catch (error) {
    if (error.status === 404 || error.status === 409) return null;
    throw error;
  }
}

function trackedFiles() {
  const output = run('git', ['ls-files', '-s']);
  const files = output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf('\t');
      const meta = line.slice(0, tab).split(/\s+/);
      return {
        mode: meta[0],
        path: line.slice(tab + 1),
      };
    });

  if (files.length === 0) {
    throw new Error('No tracked git files found. Commit or git add files before using this fallback.');
  }

  return files;
}

async function pool(items, limit, worker) {
  let index = 0;
  const results = new Array(items.length);
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (index < items.length) {
        const current = index++;
        results[current] = await worker(items[current], current);
      }
    })
  );
  return results;
}

async function ensureBranchExists(seedFile) {
  const refPath = `/repos/${owner}/${repo}/git/ref/heads/${branch}`;
  let ref = await ghMaybe(refPath);
  if (ref) return ref.object.sha;

  const seedContent = readFileSync(seedFile.path).toString('base64');
  await gh(`/repos/${owner}/${repo}/contents/${seedFile.path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: seedContent,
      branch,
    }),
  });

  ref = await gh(refPath);
  return ref.object.sha;
}

const files = trackedFiles();
console.log(`Uploading ${files.length} tracked files to ${owner}/${repo}:${branch}...`);

const headSha = await ensureBranchExists(files[0]);
const headCommit = await gh(`/repos/${owner}/${repo}/git/commits/${headSha}`);

const tree = await pool(files, 8, async (file, index) => {
  const content = readFileSync(file.path).toString('base64');
  const blob = await gh(`/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content, encoding: 'base64' }),
  });

  if ((index + 1) % 25 === 0 || index + 1 === files.length) {
    console.log(`Uploaded ${index + 1}/${files.length}`);
  }

  return {
    path: file.path,
    mode: file.mode === '100755' ? '100755' : '100644',
    type: 'blob',
    sha: blob.sha,
  };
});

const treeResult = await gh(`/repos/${owner}/${repo}/git/trees`, {
  method: 'POST',
  body: JSON.stringify({
    base_tree: headCommit.tree.sha,
    tree,
  }),
});

const commit = await gh(`/repos/${owner}/${repo}/git/commits`, {
  method: 'POST',
  body: JSON.stringify({
    message,
    tree: treeResult.sha,
    parents: [headSha],
  }),
});

await gh(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
  method: 'PATCH',
  body: JSON.stringify({ sha: commit.sha, force: false }),
});

await gh(`/repos/${owner}/${repo}`, {
  method: 'PATCH',
  body: JSON.stringify({ default_branch: branch }),
});

console.log(`Done: ${commit.sha}`);
console.log(`https://github.com/${owner}/${repo}/commit/${commit.sha}`);
