from bs4 import BeautifulSoup

# Read the HTML file
with open('forum.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

soup = BeautifulSoup(html_content, 'html.parser')

# Find forum 50
forum_items = soup.find_all('div', class_='forum-item main')
for item in forum_items:
    forum_id = item.get('data-channel-id')
    if forum_id == '50':
        print(f"Found forum 50")
        
        # Check lastpost element
        lastpost = item.find('div', class_='lastpost')
        if lastpost:
            print("Has lastpost div")
            
            # Find all wrappers
            wrappers = lastpost.find_all('div', class_='lastpost-wrapper')
            print(f"Found {len(wrappers)} wrappers")
            
            for i, wrapper in enumerate(wrappers):
                print(f"\nWrapper {i}:")
                print(f"  Classes: {wrapper.get('class')}")
                
                # Try to find elements
                title = wrapper.find('a', class_='lastpost-title')
                by = wrapper.find('div', class_='lastpost-by')
                date = wrapper.find('div', class_='lastpost-date')
                
                if title:
                    print(f"  Title: {title.text.strip()}")
                if by:
                    print(f"  By: {by.text.strip()}")
                if date:
                    print(f"  Date: {date.text.strip()}")
        
        # Also check rx-lastpost-info
        rx_lastpost = item.find('div', class_='rx-lastpost-info')
        if rx_lastpost:
            print("\nHas rx-lastpost-info")
            link = rx_lastpost.find('a', class_='lastpost-title')
            if link:
                print(f"  Title from rx: {link.text.strip()}")
        
        break
