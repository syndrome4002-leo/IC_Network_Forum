from bs4 import BeautifulSoup

# Read the HTML file
with open('forum.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

soup = BeautifulSoup(html_content, 'html.parser')

# Find forum 50
forum_items = soup.find_all('div', class_='forum-item main')
count = 0
for item in forum_items:
    forum_id = item.get('data-channel-id')
    if forum_id == '50':
        count += 1
        if count == 1:  # First occurrence
            # Get the entire lastpost section as a string
            lastpost = item.find('div', class_='lastpost')
            if lastpost:
                # Print first 2000 chars
                html_str = str(lastpost)[:2000]
                print(html_str)
            break
