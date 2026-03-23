const startBtn = document.getElementById('start');
const downloadBtn = document.getElementById('download');
const logEl = document.getElementById('log');
const statsEl = document.getElementById('stats');
let scrapedTopics = [];

const log = (msg) => {
  logEl.textContent += msg + '\n';
  logEl.scrollTop = logEl.scrollHeight;
};

const persistTopics = () => {
  chrome.storage.local.set({ scrapedTopics }, () => {
    log(`Saved ${scrapedTopics.length} topics to storage.`);
  });
};

const restoreTopics = () => {
  chrome.storage.local.get(['scrapedTopics'], (result) => {
    if (result && Array.isArray(result.scrapedTopics) && result.scrapedTopics.length > 0) {
      scrapedTopics = result.scrapedTopics;
      downloadBtn.disabled = false;
      statsEl.textContent = `Loaded ${scrapedTopics.length} saved topics.`;
      log(`Loaded ${scrapedTopics.length} topics from storage.`);
    } else {
      downloadBtn.disabled = false;
      statsEl.textContent = 'Ready (no stored topics yet)';
      log('No saved topic list found. Download will create an empty file if clicked.');
    }
  });
};

const getForumList = async () => {
  try {
    const r = await fetch(chrome.runtime.getURL('data/forum.json'));
    const list = await r.json();
    return list;
  } catch (err) {
    log('Could not load data/forum.json. Paste content here in data/forum.json.');
    throw err;
  }
};

const parseTopicsFromHtml = (text, subForumId, forumId) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const rows = [...doc.querySelectorAll('table.topic-list-container tbody.topic-list tr.topic-item')];
  const parseNumber = (txt) => {
    if (!txt) return 0;
    const m = txt.replace(/,/g, '').match(/-?\d+/);
    return m ? Number(m[0]) : 0;
  };

  return rows.map((row) => {
    const titleEl = row.querySelector('a.topic-title');
    const startedByEl = row.querySelector('td.cell-topic .topic-info a');
    const startedAtEl = row.querySelector('td.cell-topic .topic-info .date');
    let rawId = row.getAttribute('data-node-id') || '';
    const id = Number(rawId) || null;
    const link = titleEl ? titleEl.getAttribute('href') : '';

    // statistics
    const postsEl = row.querySelector('.posts-count');
    const viewsEl = row.querySelector('.views-count');
    const votesEl = row.querySelector('.votes-count');

    // last post info
    const lastByEl = row.querySelector('.lastpost-by a') || row.querySelector('.lastpost-by');
    const lastAtEl = row.querySelector('.post-date') || row.querySelector('.lastpost-date');

    return {
      id,
      sub_forum_id: subForumId,
      forum_id: forumId,
      title: titleEl ? titleEl.textContent.trim() : '',
      started_by: startedByEl ? startedByEl.textContent.trim() : '',
      started_at: startedAtEl ? startedAtEl.textContent.trim() : '',
      link,
      statistics_response: postsEl ? parseNumber(postsEl.textContent) : 0,
      statistics_views: viewsEl ? parseNumber(viewsEl.textContent) : 0,
      statistics_reactions: votesEl ? parseNumber(votesEl.textContent) : 0,
      last_post_by: lastByEl ? lastByEl.textContent.trim() : '',
      last_post_at: lastAtEl ? lastAtEl.textContent.trim() : ''
    };
  });
};

const getNextPageUrl = (doc, currentUrl) => {
  const next = doc.querySelector('a.js-pagenav-next-button:not(.h-hide-imp):not([aria-hidden="true"])');
  if (!next) return null;
  const href = next.getAttribute('href');
  if (!href) return null;
  return new URL(href, currentUrl).toString();
};

const scrapeOneForum = async (forum, seenIds) => {
  log(`Scraping forum '${forum.title}' (${forum.link})`);
  let nextUrl = forum.link;
  let page = 1;
  while (nextUrl) {
    try {
      log(`> page ${page}: ${nextUrl}`);
      const res = await fetch(nextUrl, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const items = parseTopicsFromHtml(html, forum.id, forum.forum_id);
      const newItems = items.filter(item => item.id && !seenIds.has(item.id));
      newItems.forEach(item => seenIds.add(item.id));
      scrapedTopics = scrapedTopics.concat(newItems);
      const candidate = getNextPageUrl(doc, nextUrl);
      if (!candidate || candidate === nextUrl) break;
      nextUrl = candidate;
      page += 1;
      await new Promise((resolve) => setTimeout(resolve, 450));
    } catch (err) {
      log(`Error scraping ${nextUrl}: ${err.message}`);
      break;
    }
  }
  log(`Finished ${forum.title} (${forum.link})`);
};

const runScrape = async () => {
  startBtn.disabled = true;
  scrapedTopics = [];
  const seenIds = new Set();
  statsEl.textContent = 'Loading forums...';
  try {
    const forums = await getForumList();
    if (forums.length === 0) {
      statsEl.textContent = 'No sub-forum entries found in forum.json.';
      log('No sub-forum forums to scrape.');
    } else {
      for (let i = 0; i < forums.length; i += 1) {
        const f = forums[i];
        statsEl.textContent = `Scraping forum ${i + 1}/${forums.length}: ${f.title}`;
        await scrapeOneForum(f, seenIds);
        statsEl.textContent = `Scraped ${i + 1} / ${forums.length} forums`;
        // After successfully scraping a forum, auto-download cumulative scraped topics so far
        try {
          if (scrapedTopics.length > 0) {
            const blob = new Blob([JSON.stringify(scrapedTopics, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            a.download = `icn-topics-${scrapedTopics.length}-items-${ts}.json`;
            a.click();
            URL.revokeObjectURL(url);
            log(`Auto-downloaded ${scrapedTopics.length} cumulative topics (after forum ${f.id}).`);
          } else {
            log(`No topics scraped yet to download.`);
          }
        } catch (err) {
          log(`Auto-download failed: ${err.message}`);
        }
      }
      persistTopics();
      statsEl.textContent = `Done: ${scrapedTopics.length} topics scraped.`;
      log(`Total scraped topics: ${scrapedTopics.length}`);
      downloadBtn.disabled = false;
    }
  } catch (err) {
    statsEl.textContent = `Failed: ${err.message}`;
    log(`Fatal error: ${err.message}`);
  } finally {
    startBtn.disabled = false;
    downloadBtn.disabled = false;
  }
};

const downloadJson = () => {
  const downloadPayload = () => {
    if (!scrapedTopics || scrapedTopics.length === 0) {
      log('No topics to download.');
      return;
    }
    const blob = new Blob([JSON.stringify(scrapedTopics, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'icn-forum-topics.json';
    a.click();
    URL.revokeObjectURL(url);
    log(`Downloaded ${scrapedTopics.length} topics as JSON.`);
  };

  if (scrapedTopics.length > 0) {
    downloadPayload();
    return;
  }

  chrome.storage.local.get(['scrapedTopics'], (result) => {
    if (result && Array.isArray(result.scrapedTopics) && result.scrapedTopics.length > 0) {
      scrapedTopics = result.scrapedTopics;
      downloadPayload();
    } else {
      log('No scraped topics are currently stored. Run scraping first.');
    }
  });
};

startBtn.addEventListener('click', runScrape);
downloadBtn.addEventListener('click', downloadJson);

restoreTopics();
