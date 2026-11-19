import fetch from "node-fetch"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const baseDir = path.dirname(scriptsDir)

const conf = {
  repo: {
    base: "Civitasv/Civitasv",
    branch: "master",
  },
  imgDir: "assets",
  api: "https://github-readme-stats.vercel.app/api",
  styles: {
    light: {},
    dark: {
      title_color: "58a6ff",
      text_color: "adbac7",
      bg_color: "00000000",
      border_color: "444c56",
    },
  },
}

const data = [
  {
    kind: "content",
    content: "Hi, I'm Civitasv, a passionate C++ developer. 💬 Ask me about anything, I am happy to help."
  },
  {
    kind: "section",
    title: "Neovim Projects",
    cards: [
      {
        kind: "repo",
        user: "Civitasv",
        repo: "cmake-tools.nvim",
        description: "CMake integration in Neovim",
      },
      {
        kind: "repo",
        user: "Civitasv",
        repo: "runvim",
        description: "Beautiful, fast, functional Configuration for Neovim.",
      },
    ],
  },
  {
    kind: "section",
    title: "C++ Projects",
    cards: [
      {
        kind: "repo",
        user: "Civitasv",
        repo: "asciichart",
        description: "Nice-looking lightweight console ASCII line charts, using C++, no dependencies.",
      },
      {
        kind: "repo",
        user: "Civitasv",
        repo: "mini-json-parser",
        description:
          "A Tiny Json Parser",
      },
    ],
  },
  {
    kind: "section",
    title: "Other Projects",
    cards: [
      {
        kind: "repo",
        user: "Civitasv",
        repo: "AMapPoi",
        description: "POI 搜索工具、地理编码工具",
      },
    ],
  },
  { kind: "separator" },
  {
    kind: "section",
    cards: [
      {
        kind: "user",
        user: "Civitasv",
        description: "Civitasv's GitHub Stats",
      },
    ],
  },
]

const imgCache = new Map()

function renderCachedImage({ key, url, alt, fragment }) {
  imgCache.set(key, url)
  const cacheUrl = `https://raw.githubusercontent.com/${conf.repo.base}/${conf.repo.branch}/${conf.imgDir}/${key}`
  return `<img src="${cacheUrl}${fragment ? "#" + fragment : ""}" alt="${alt}">`
}

function renderRepoCard({ user, repo, description, style }) {
  const search = new URLSearchParams({
    username: user,
    repo,
    show_owner: true,
    ...conf.styles[style],
  })
  return [
    `<a href="https://github.com/${user}/${repo}#gh-${style}-mode-only">`,
    renderCachedImage({
      key: `${user}-${repo}-${style}.svg`,
      url: `${conf.api}/pin/?${search}`,
      alt: `${repo}: ${description}`,
      fragment: `gh-${style}-mode-only`,
    }),
    `</a>`,
  ].join("")
}

function renderUserCardStyle({ user, description, style }) {
  const search = new URLSearchParams({
    username: user,
    show_icons: true,
    ...conf.styles[style],
  })
  return [
    `<a href="https://github.com/${user}#gh-${style}-mode-only">`,
    renderCachedImage({
      key: `${user}-${style}.svg`,
      url: `${conf.api}/?${search}`,
      alt: `${user}: ${description}`,
      fragment: `gh-${style}-mode-only`,
    }),
    `</a>`,
  ].join("")
}

function renderCardStyles(render, { user, repo, description }) {
  return [
    render({ user, repo, description, style: "dark" }),
    render({ user, repo, description, style: "light" }),
  ].join("\n")
}

function renderSection({ title, cards }) {
  const rows = cards.reduce((rows, card, i) => {
    if (i % 2 === 0) {
      rows.push([])
    }
    rows[rows.length - 1].push(renderNode(card))
    return rows
  }, [])
  const rowDivs = rows.map((row) => {
    return [
      `<div float="left">`,
      `${row.join("\n&nbsp;\n")}`,
      `&nbsp;`,
      `</div>`,
    ].join("\n")
  })
  return [
    title ? `### ${title}\n\n` : "",
    ...rowDivs,
    "\n",
  ].join("")
}

function renderContent({ content }) {
  return `<p>${content}</p>\n`
}

function renderNode({ kind, ...rest }) {
  switch (kind) {
    case "repo":
      return renderCardStyles(renderRepoCard, rest)
    case "user":
      return renderCardStyles(renderUserCardStyle, rest)
    case "separator":
      return "---\n"
    case "section":
      return renderSection(rest)
    case "content":
      return renderContent(rest)
    default:
      throw new Error(`Unknown card kind: ${kind}`)
  }
}

function isSvg(buffer) {
  const text = buffer.toString("utf8", 0, Math.min(buffer.length, 2048))
  const head = text.trimStart()
  return (
    (head.startsWith("<svg") || head.startsWith("<?xml")) &&
    !text.includes("Something went wrong") &&
    !text.includes("DEPLOYMENT_PAUSED")
  )
}

async function fetchSvg(url) {
  let lastError
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const img = await fetch(url)
      if (!img.ok) {
        throw new Error(`HTTP ${img.status} ${img.statusText}`)
      }
      const buffer = Buffer.from(await img.arrayBuffer())
      if (!isSvg(buffer)) {
        throw new Error(
          `non-SVG response: ${buffer.toString("utf8", 0, 120).replace(/\s+/g, " ").trim()}`
        )
      }
      return buffer
    } catch (error) {
      lastError = error
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
      }
    }
  }
  throw lastError
}

const content = data.map(renderNode).join("\n")

for (const [key, url] of imgCache.entries()) {
  const imgPath = path.join(baseDir, conf.imgDir, key)
  let svg
  try {
    console.log(`Fetching ${url}`)
    svg = await fetchSvg(url)
  } catch (error) {
    const cached = await fs.readFile(imgPath).catch(() => null)
    if (cached && isSvg(cached)) {
      console.warn(`Keeping cached ${key}: ${error.message}`)
      continue
    }
    throw new Error(`Failed to fetch a valid SVG for ${key}: ${error.message}`)
  }
  await fs.mkdir(path.dirname(imgPath), { recursive: true })
  console.log(`Writing ${imgPath}`)
  await fs.writeFile(imgPath, svg)
}

console.log(`Writing README.md`)
await fs.writeFile(path.join(baseDir, "README.md"), content)
