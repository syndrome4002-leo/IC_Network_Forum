const startBtn = document.getElementById('start');
const downloadBtn = document.getElementById('download');
const logEl = document.getElementById('log');
const metaEl = document.getElementById('meta');
let scrapedPosts = [];

const log = (msg) => {
  const time = new Date().toLocaleTimeString();
  logEl.textContent += `[${time}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
  metaEl.textContent = `status: ${msg}`;
};

const cleanText = (value) => {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
};

const loadTopicList = async () => {
  try {
    const response = await fetch(chrome.runtime.getURL('data/topics.json'));
    if (!response.ok) throw new Error(`Failed to load topics.json (${response.status})`);
    return await response.json();
  } catch (error) {
    throw new Error('Could not load data/topics.json from extension files. Please copy Data/topics.json into posts-scraper-extension/data/topics.json');
  }
};

const parsePostsFromHtml = (html, topicId, topicTitle) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const postNodes = Array.from(doc.querySelectorAll('li.b-post'));
  return postNodes.map((post) => {
    // Post author from user info detail div
    let author = '';
    const detailUser = post.querySelector('.b-userinfo__details .author [itemprop="name"]');
    if (detailUser && detailUser.textContent.trim()) {
      author = detailUser.textContent.trim();
    }

    if (!author) {
      // fallback all earlier selectors
      const authorCandidates = post.querySelectorAll('.userinfo, .b-userinfo');
      for (const candidate of authorCandidates) {
        const usernameEl = candidate.querySelector('a[href*="/member"], a[href*="/profile"], .b-post__author-name, .b-post__username, .username, .user-name');
        if (usernameEl && usernameEl.textContent.trim()) {
          author = usernameEl.textContent.trim();
          break;
        }
      }
    }

    if (!author) {
      const fallback = post.querySelector('.b-post__author-name, .b-post__username, .userinfo a, .b-userinfo a');
      if (fallback && fallback.textContent.trim()) author = fallback.textContent.trim();
    }

    // Post date
    let postAt = '';
    const dateEl = post.querySelector('time[itemprop="dateCreated"], .b-post__timestamp time, .post-date, .date, .b-post__timestamp');
    if (dateEl) {
      postAt = dateEl.textContent.trim();
    }

    // Contents text; skip signatures, dates, and post counters (#1, #2 etc.)
    let content = '';
    const contentEl = post.querySelector('.js-post__content-text, .b-post__content, .b-post__body, [itemprop="text"], .message, .post-content');
    if (contentEl) {
      const clone = contentEl.cloneNode(true);
      clone.querySelectorAll('.post-signature, .signature, time[itemprop="dateCreated"], .b-post__timestamp, .post-date, .date, .b-post__count, .js-show-post-link, .b-post__footer, .b-post__footer__postinfo, .b-post__footer__bottom-bar, .b-post__controls, .b-post__title').forEach((el) => el.remove());
      content = cleanText(clone.textContent);
      // remove any residual UI labels like "1 Comment Post Cancel"
      content = content.replace(/\b\d+\s+Comment\s+Post\s+Cancel\b/gi, '');
      content = content.replace(/\bComment\s+Post\s+Cancel\b/gi, '');
      content = cleanText(content);
    }

    // Signature (if available)
    let signature = '';
    const sigEl = post.querySelector('.post-signature, .signature');
    if (sigEl) {
      signature = cleanText(sigEl.textContent);
    }

    return {
      topic_id: topicId,
      post_by: author || 'Unknown',
      post_at: postAt || 'Unknown',
      contents: content,
      signature: signature
    };
  });
};

const getNextPageUrl = (doc, currentUrl) => {
  // site uses a next button class that may be hidden
  let link = doc.querySelector('a.js-pagenav-next-button:not(.h-hide-imp):not([aria-hidden="true"]), a[rel="next"], .pagenav a.next');
  if (!link) return null;
  const href = link.getAttribute('href');
  if (!href) return null;
  return new URL(href, currentUrl).toString();
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const downloadCumulativeJson = (data) => {
  if (!Array.isArray(data)) return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  a.download = `icn-posts-${data.length}-items-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const scrapeTopic = async (topic) => {
  if (!topic || !topic.link) return [];
  log(`Topic [${topic.id}] ${topic.title}`);
  let pageUrl = topic.link;
  let allPosts = [];
  let p = 1;

  while (pageUrl) {
    log(`  topic page ${p}: ${pageUrl}`);
    const res = await fetch(pageUrl, { cache: 'no-cache' });
    if (!res.ok) {
      log(`  failed to fetch page ${pageUrl} status ${res.status}`);
      break;
    }
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const posts = parsePostsFromHtml(html, topic.id, topic.title);

    if (posts.length === 0) {
      log(`  no posts found on page ${p} for topic ${topic.id}`);
    } else {
      log(`  scraped ${posts.length} posts on page ${p}`);
    }

    // Avoid duplicates by checking post_at+post_by+content fingerprint (best-effort)
    const existingKeys = new Set(allPosts.map((x) => `${x.post_by}|${x.post_at}|${x.contents}`));
    const deduped = posts.filter((x) => {
      const key = `${x.post_by}|${x.post_at}|${x.contents}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });
    allPosts = allPosts.concat(deduped);
    scrapedPosts = scrapedPosts.concat(deduped);

    const nextPage = getNextPageUrl(doc, pageUrl);
    if (!nextPage || nextPage === pageUrl) break;
    pageUrl = nextPage;
    p += 1;
    await sleep(650);
  }

  log(`  topic ${topic.id} complete, total posts collected for topic: ${allPosts.length}`);
  return allPosts;
};

const runScrape = async () => {
  startBtn.disabled = true;
  scrapedPosts = [];
  log('Starting scrape. Loading topics list...');

  try {
    const topics = await loadTopicList();
    if (!Array.isArray(topics) || topics.length === 0) {
      log('topics.json is empty or invalid.');
      return;
    }

    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      log(`Scraping topic ${i+1}/${topics.length} (id=${topic.id})`);
      await scrapeTopic(topic);
    }

    log(`Scraping complete. ${scrapedPosts.length} total posts extracted.`);
    downloadBtn.disabled = false;
  } catch (err) {
    log(`Error: ${err.message}`);
  } finally {
    startBtn.disabled = false;
    downloadBtn.disabled = false;
  }
};

const downloadJson = () => {
  if (!scrapedPosts || scrapedPosts.length === 0) {
    log('No posts scraped yet. Run scraper first.');
    return;
  }
  downloadCumulativeJson(scrapedPosts);
  log('Manual download triggered.');
};

startBtn.addEventListener('click', runScrape);
downloadBtn.addEventListener('click', downloadJson);
