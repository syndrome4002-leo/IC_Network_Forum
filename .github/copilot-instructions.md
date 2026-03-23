# Copilot instructions — Static_Forum_website

Purpose: Help an AI coding agent get productive quickly in this repository.

Big picture
- This repo stores a static snapshot of an online forum and small tooling to extract structured JSON from the forum HTML.
- Two extraction strategies coexist: `extract_forums.py` and `parse_forums.py` (both parse `forum.html` into `Data/*.json`).
- Browser extensions under `forum-scraper-extension/` and `sub-forum-scraper-extension/` provide a UI to scrape topics and export JSON; extension data may appear under each extension's `data/` folder.

Primary data flow
- Scrape page(s) with the Chrome extension -> export JSON (or save page as `forum.html`).
- Run the Python parsers to build canonical JSON in `Data/`:
  - `python parse_forums.py` (preferred; has additional cleaning)
  - `python update_subforum_flags.py` (marks forums that have subforums)
  - `extract_forums.py` is an older extractor that also writes `Data/forum.json` and `Data/sub-forum.json`.

Key files and conventions (search before changing)
- HTML parsing relies on specific class names and attributes in `forum.html`:
  - main forum containers: `class="forum-item"` and `id="forum<id>"`
  - sub-forums: `class="subforum-item"` and `data-channel-id="<id>"`
  - title anchors use `class="forum-title"` / `class="subforum-title"`
- JSON shape produced and expected: array of objects with `id`, `title`, `link`, and `sub_forum` (boolean) for `Data/forum.json`, and `id`, `forum_id`, `title`, `link` for `Data/sub-forum.json`. See [Data/forum.json](../Data/forum.json) for an example.

Workflows and commands
- Refresh data from the live site (typical):
  1. Use the extension UI (`forum-scraper-extension`) on `https://forum.ic-network.com` and click "Download JSON", or save the page as `forum.html` in repo root.
  2. Run `python parse_forums.py` to regenerate `Data/forum.json` and `Data/sub-forum.json`.
  3. Run `python update_subforum_flags.py` to set the `sub_forum` flags.

Editing guidance for parsers
- Parsers use regex with `re.DOTALL` to consume multi-line HTML; when HTML structure changes, update the regexes in `parse_forums.py` (forum_pattern, subforum_pattern).
- When changing class names in `forum.html`, update both parsing patterns and any references in `extract_forums.py`.

Extension-specific notes
- `forum-scraper-extension/content.js` injects a sidebar and sends messages to `background.js`. The extension stores/export data via `chrome.storage` and download actions.
- Extensions are simple: `manifest.json` uses `host_permissions` for `https://forum.ic-network.com/*`.

Debugging tips
- Reproduce parsing locally by placing the downloaded `forum.html` at repo root and running the parsers.
- Use small, focused regex edits and run `python parse_forums.py` to view printed samples (the script prints sample outputs).
- Validate JSON in `Data/` after each run.

When to ask the human
- If the forum HTML template changes (different classes/ids), ask for a sample `forum.html` or a note about the change before modifying regexes.

If anything here is unclear or you want more examples (unit tests, CI steps, or a sample sanitized `forum.html`), tell me which section to expand.
