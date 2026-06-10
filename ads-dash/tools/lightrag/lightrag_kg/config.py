"""Configuration for lightrag-kg.

Loads .env from (first match wins; chain is permissive — multiple files merged):
  - <project_root>/.env.local   (preferred)
  - <project_root>/.env
  - <package_root>/.env

PROJECT_ROOT is the ads-dash repo (parent of tools/).
PACKAGE_ROOT is tools/lightrag/.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = PACKAGE_ROOT.parent.parent

for candidate in [
    PROJECT_ROOT / ".env.local",
    PROJECT_ROOT / ".env",
    PACKAGE_ROOT / ".env",
]:
    if candidate.exists():
        load_dotenv(candidate, override=False)

PROVIDER = "openai"
WORKING_DIR = PACKAGE_ROOT / "rag_storage"
MANIFEST = PACKAGE_ROOT / ".index_manifest.json"
VAULT_DIR = PROJECT_ROOT / "docs" / "knowledge-graph"

INCLUDE_GLOBS = [
    "src/**/*.js",
    "src/**/*.jsx",
    "src/**/*.ts",
    "src/**/*.tsx",
    "src/**/*.css",
    "*.md",
    "docs/**/*.md",
    "**/README.md",
    "package.json",
    "vite.config.*",
    "vercel.json",
    "*.config.js",
    "*.config.ts",
    ".env.example",
    "tsconfig.json",
    "jsconfig.json",
    "supabase/**/*.sql",
    "supabase/**/*.toml",
]

EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    "dist",
    "build",
    ".git",
    "target",
    "__pycache__",
    ".venv",
    "venv",
    ".pytest_cache",
    "_generated",
    "coverage",
    ".turbo",
    ".cache",
}

EXCLUDE_GLOBS = [
    "**/*.lock",
    "**/*.lockb",
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
    "**/*.tsbuildinfo",
    "**/*.min.js",
    "**/*.min.css",
    "**/*-generated*",
    "**/_generated/**",
    "**/.DS_Store",
    "**/desktop.ini",
    "tools/lightrag/**",
    "docs/knowledge-graph/**",
    "**/*.png",
    "**/*.jpg",
    "**/*.jpeg",
    "**/*.gif",
    "**/*.svg",
    "**/*.ico",
    "**/*.pdf",
    "**/*.zip",
    "**/*.gz",
    "**/*.tar",
    "**/*.woff",
    "**/*.woff2",
    "**/*.ttf",
    "**/*.otf",
    "**/*.mp4",
    "**/*.mp3",
    "**/*.webm",
]

MAX_FILE_BYTES = 500_000

LANG_BY_EXT = {
    ".js": "javascript",
    ".jsx": "javascript-react",
    ".ts": "typescript",
    ".tsx": "typescript-react",
    ".css": "css",
    ".md": "markdown",
    ".json": "json",
    ".sql": "sql",
    ".toml": "toml",
    ".py": "python",
    ".html": "html",
}


def status():
    return {
        "provider": PROVIDER,
        "project_root": str(PROJECT_ROOT),
        "package_root": str(PACKAGE_ROOT),
        "working_dir": str(WORKING_DIR),
        "vault_dir": str(VAULT_DIR),
        "manifest": str(MANIFEST),
        "openai_key_set": bool(os.environ.get("OPENAI_API_KEY")),
    }
