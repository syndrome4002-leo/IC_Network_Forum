#!/usr/bin/env python3
import json
import re
from pathlib import Path
from bs4 import BeautifulSoup

# Load forum.html
html_path = Path('forum.html')
html_content = html_path.read_text(encoding='utf-8')
print(f"Loaded forum.html ({len(html_content)} bytes)")

# Parse HTML with BeautifulSoup
soup = BeautifulSoup(html_content, 'html.parser')

# Find all main forum items
forum_divs = soup.select('div.forum-item.main')
print(f"Found {len(forum_divs)} main forums")

# Extract forum data
forums = []

def clean_text(text):
    """Remove extra whitespace and decode HTML entities"""
    if not text:
        return ""
    return text.strip()

def extract_number(text):
    """Extract only digits from text"""
    if not text:
        return 0
    return int(re.sub(r'[^0-9]', '', str(text)))

for forum_div in forum_divs:
    # Get forum ID
    forum_id = forum_div.get('data-channel-id') or ''
    if not forum_id and forum_div.get('id'):
        forum_id = forum_div.get('id', '').replace('forum', '')
    
    # Get title and link
    title_elem = forum_div.select_one('a.forum-title')
    title = clean_text(title_elem.text) if title_elem else ''
    link = title_elem.get('href', '') if title_elem else ''
    
    # Check if forum has subforums
    has_subchannels = 'has-subchannels' in forum_div.get('class', [])
    
    # Extract topics count
    topics_count_elem = forum_div.select_one('div.topics-count span.count')
    topics = extract_number(topics_count_elem.text) if topics_count_elem else 0
    
    # Extract posts count
    posts_count_elem = forum_div.select_one('div.posts-count span.count')
    posts = extract_number(posts_count_elem.text) if posts_count_elem else 0
    
    # Extract last post title
    last_post_title_elem = forum_div.select_one('a.lastpost-title')
    last_post_title = clean_text(last_post_title_elem.text) if last_post_title_elem else ''
    
    # Extract last post by
    last_post_by_elem = forum_div.select_one('div.lastpost-by')
    last_post_by = ''
    if last_post_by_elem:
        author_link = last_post_by_elem.select_one('a')
        if author_link:
            last_post_by = clean_text(author_link.text)
        else:
            last_post_by = clean_text(last_post_by_elem.text).replace('by', '').strip()
    
    # Extract last post date
    last_post_date_elem = forum_div.select_one('div.lastpost-date')
    last_post_at = clean_text(last_post_date_elem.text) if last_post_date_elem else ''
    
    # Create forum dict
    forum = {
        'id': int(forum_id) if forum_id.isdigit() else forum_id,
        'title': title,
        'link': link,
        'sub_forum': has_subchannels,
        'topics': topics,
        'posts': posts,
        'last_post_title': last_post_title,
        'last_post_by': last_post_by,
        'last_post_at': last_post_at
    }
    forums.append(forum)

print(f"Extracted {len(forums)} forums")

# Save to Data/forum.json
output_path = Path('Data/forum.json')
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(forums, f, indent=2, ensure_ascii=False)

print(f"Saved {len(forums)} forums to {output_path}")

print("\nFirst 3 forums:")
for forum in forums[:3]:
    print(json.dumps(forum, indent=2))
