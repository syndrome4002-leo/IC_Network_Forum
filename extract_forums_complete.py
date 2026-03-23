from bs4 import BeautifulSoup
import json
import re

# Read the HTML file
with open('forum.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

soup = BeautifulSoup(html_content, 'html.parser')

# Find all forum items
forum_items = soup.find_all('div', class_='forum-item main')

forums = []

for item in forum_items:
    # Extract forum ID
    forum_id = item.get('data-channel-id')
    if not forum_id:
        continue
    
    try:
        forum_id = int(forum_id)
    except:
        continue
    
    # Extract title
    title_elem = item.find('a', class_='forum-title')
    title = title_elem.text.strip() if title_elem else ""
    
    # Extract link
    link = title_elem.get('href') if title_elem else ""
    
    # Check if has subchannels
    has_subchannels = 'has-subchannels' in item.get('class', [])
    
    # Extract topics count
    topics_count_elem = item.find('div', class_='topics-count')
    topics = 0
    if topics_count_elem:
        count_span = topics_count_elem.find('span', class_='count')
        if count_span:
            try:
                topics = int(count_span.text.strip())
            except:
                topics = 0
    
    # Extract posts count
    posts_count_elem = item.find('div', class_='posts-count')
    posts = 0
    if posts_count_elem:
        count_span = posts_count_elem.find('span', class_='count')
        if count_span:
            try:
                posts = int(count_span.text.strip())
            except:
                posts = 0
    
    # Extract last post info
    lastpost_elem = item.find('div', class_='lastpost')
    last_post_title = ""
    last_post_by = ""
    last_post_at = ""
    
    if lastpost_elem:
        # Try to find title from lastpost-title link within lastpost
        title_link = lastpost_elem.find('a', class_='lastpost-title')
        if title_link:
            last_post_title = title_link.text.strip()
        
        # Try to find by and date from lastpost-info within lastpost-wrapper hide-on-cards
        hide_wrapper = lastpost_elem.find('div', class_='lastpost-wrapper')
        if hide_wrapper and 'hide-on-cards' not in hide_wrapper.get('class', []):
            # Try next wrapper
            all_wrappers = lastpost_elem.find_all('div', class_='lastpost-wrapper')
            if all_wrappers:
                hide_wrapper = all_wrappers[0]
        
        if hide_wrapper:
            # Get last post by
            by_elem = hide_wrapper.find('div', class_='lastpost-by')
            if by_elem:
                by_link = by_elem.find('a')
                if by_link:
                    last_post_by = by_link.get_text(strip=True)
            
            # Get last post date
            date_elem = hide_wrapper.find('div', class_='lastpost-date')
            if date_elem:
                # Get text but exclude child elements like links
                date_text = ""
                for child in date_elem.children:
                    if isinstance(child, str):
                        text = child.strip()
                        if text:
                            date_text += text + " "
                last_post_at = date_text.strip()
    
    # If we still don't have last post info, try rx-lastpost-info section
    if not last_post_title:
        rx_lastpost = item.find('div', class_='rx-lastpost-info')
        if rx_lastpost:
            link = rx_lastpost.find('a', class_='lastpost-title')
            if link:
                last_post_title = link.text.strip()
    
    forum = {
        "id": forum_id,
        "title": title,
        "link": link,
        "sub_forum": has_subchannels,
        "topics": topics,
        "posts": posts,
        "last_post_title": last_post_title,
        "last_post_by": last_post_by,
        "last_post_at": last_post_at
    }
    
    forums.append(forum)

# Sort by ID for consistency
forums.sort(key=lambda x: x['id'])

# Write to JSON
with open('Data/forum.json', 'w', encoding='utf-8') as f:
    json.dump(forums, f, indent=4, ensure_ascii=False)

print(f"Extracted {len(forums)} forums")
for forum in forums[:5]:
    print(f"  ID: {forum['id']}, Title: {forum['title']}, Topics: {forum['topics']}, Posts: {forum['posts']}")
