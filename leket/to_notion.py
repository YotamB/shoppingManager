import os
"""
Upload leket hasade order history to Notion
Creates a database under root page
"""
import json, urllib.request, urllib.error

TOKEN = "os.environ['NOTION_TOKEN']"
ROOT = "3375d4e4-4f7f-8058-8626-c30c1e8421f4"

def api(method, endpoint, data=None):
    url = f"https://api.notion.com/v1/{endpoint}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method, headers={
        "Authorization": f"Bearer {TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"API Error {e.code}: {err[:300]}")
        raise

# Load orders
data = json.load(open("/Users/roni/.openclaw/workspace/leket/orders.json"))
rows = data["orders"][0]["rows"]
header = rows[0]  # ['מספר הזמנה', 'תאריך ושעה', 'סה"כ לתשלום', 'סוג תשלום', 'מצב התשלום']
orders = rows[1:]

print(f"Header: {header}")
print(f"Total orders: {len(orders)}")

# 1. Create a new page with a database
print("\n📄 Creating Notion page + database...")

# Create parent page first
parent_page = api("POST", "pages", {
    "parent": {"page_id": ROOT},
    "icon": {"emoji": "🥬"},
    "properties": {
        "title": {"title": [{"text": {"content": "🥬 לקט השדה – היסטוריית הזמנות"}}]}
    },
    "children": [
        {"object": "block", "type": "paragraph", "paragraph": {
            "rich_text": [{"text": {"content": f"עודכן אוטומטית | {len(orders)} הזמנות"}}]
        }}
    ]
})
parent_page_id = parent_page["id"]
print(f"Parent page: {parent_page.get('url')}")

# 2. Create database inside the page
db = api("POST", "databases", {
    "parent": {"page_id": parent_page_id},
    "title": [{"text": {"content": "הזמנות"}}],
    "properties": {
        "מספר הזמנה": {"title": {}},
        "תאריך": {"rich_text": {}},
        "סכום": {"rich_text": {}},
        "סוג תשלום": {"select": {
            "options": [
                {"name": "שולם", "color": "green"},
                {"name": "אשראי", "color": "blue"},
                {"name": "PayPal", "color": "purple"},
                {"name": "אחר", "color": "gray"}
            ]
        }},
        "מצב": {"select": {
            "options": [
                {"name": "הושלם", "color": "green"},
                {"name": "לא הושלם", "color": "red"},
                {"name": "ממתין", "color": "yellow"}
            ]
        }},
        "קישור": {"url": {}}
    }
})
db_id = db["id"]
print(f"Database created: {db_id}")

# 3. Add all orders
print("\n📦 Adding orders...")
for i, order in enumerate(orders):
    if len(order) < 5:
        continue
    order_num, date_time, amount, payment_type, status = order[0], order[1], order[2], order[3], order[4]
    
    # Normalize payment type for select
    pay_sel = "שולם" if "שולם" in payment_type else "אשראי" if "אשראי" in payment_type else "אחר"
    status_sel = "הושלם" if "הושלם" in status else "לא הושלם" if "לא הושלם" in status else "ממתין"
    
    order_url = f"https://www.lekethasade.co.il/current_customer/orders/{order_num}"
    
    page = api("POST", "pages", {
        "parent": {"database_id": db_id},
        "properties": {
            "מספר הזמנה": {"title": [{"text": {"content": order_num}}]},
            "תאריך": {"rich_text": [{"text": {"content": date_time}}]},
            "סכום": {"rich_text": [{"text": {"content": amount}}]},
            "סוג תשלום": {"select": {"name": pay_sel}},
            "מצב": {"select": {"name": status_sel}},
            "קישור": {"url": order_url}
        }
    })
    print(f"  [{i+1}/{len(orders)}] #{order_num} {date_time} {amount} → {status_sel}")

print(f"\n✅ Done! Notion page: {parent_page.get('url')}")
