import os
"""Upload full leket analysis to Notion"""
import json, urllib.request, urllib.error
from collections import Counter, defaultdict
from datetime import datetime

TOKEN = "os.environ['NOTION_TOKEN']"
ROOT = "3375d4e4-4f7f-8058-8626-c30c1e8421f4"

parsed = json.load(open("/Users/roni/.openclaw/workspace/leket/parsed_orders.json"))
orders = parsed["orders"]
item_summary = parsed["item_summary"]

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

def p(text): return {"object":"block","type":"paragraph","paragraph":{"rich_text":[{"type":"text","text":{"content":str(text)[:2000]}}]}}
def h1(text): return {"object":"block","type":"heading_1","heading_1":{"rich_text":[{"type":"text","text":{"content":text}}]}}
def h2(text): return {"object":"block","type":"heading_2","heading_2":{"rich_text":[{"type":"text","text":{"content":text}}]}}
def callout(text, emoji="📊", color="blue_background"):
    return {"object":"block","type":"callout","callout":{"rich_text":[{"type":"text","text":{"content":str(text)[:2000]}}],"icon":{"emoji":emoji},"color":color}}
def divider(): return {"object":"block","type":"divider","divider":{}}

def parse_date(d):
    try: return datetime.strptime(d[:8], "%d/%m/%y")
    except: return datetime.min

dated = [o for o in orders if o["date"]]
dated.sort(key=lambda o: parse_date(o["date"]))
first_date = dated[0]["date"] if dated else "?"
last_date = dated[-1]["date"] if dated else "?"

total_orders = len(orders)
avg_items = sum(o["item_count"] for o in orders) / max(total_orders, 1)

# Top items
top30 = item_summary[:30]
top_text = ""
for item in top30:
    top_text += f"• {item['name']}: {item['total_qty']:.1f} יחידות ב-{item['num_orders']} הזמנות\n"

# Unique items count
print(f"Total: {total_orders} orders, {len(item_summary)} unique items")

# --- Build insight blocks ---
insight_text = (
    f"📦 40 הזמנות נותחו מ-{first_date} עד {last_date}\n"
    f"🛒 ממוצע {avg_items:.0f} פריטים להזמנה\n"
    f"🌿 228 מוצרים שונים הוזמנו סה\"כ\n\n"
    f"🥇 הפריטים שהוזמנו בכל הזמנה כמעט:\n"
    f"• תפוח עץ פינק ליידי – 37/40 הזמנות\n"
    f"• בננה – 37/40 הזמנות\n"
    f"• סימפונית שרי מארז – 37/40 הזמנות\n"
    f"• לבבות חסה שטוף מארז – 37/40 הזמנות\n"
    f"• אגס – 37/40 הזמנות\n"
    f"• פלפל אדום – 36/40 הזמנות\n"
    f"• מלפפון חממה – 34/40 הזמנות\n"
    f"• יוגורט עיזים – 32/40 הזמנות\n\n"
    f"🥒 המלפפון שלך: 72.6 יחידות ב-34 הזמנות (~2.1 לכל הזמנה)\n"
    f"🍎 תפוח פינק ליידי: 88.2 יח' ב-37 הזמנות (~2.4 לכל הזמנה)\n"
    f"🍌 בנאנה: 77.2 יח' ב-37 הזמנות (~2.1 לכל הזמנה)"
)

# Order detail toggles
order_blocks = []
for o in sorted(orders, key=lambda x: parse_date(x["date"]), reverse=True):
    if not o["items"]:
        continue
    items_text = "\n".join(
        f"• {it['name']}: {it['qty']} × {it['price']}" 
        for it in o["items"]
    )
    order_blocks.append({
        "object": "block",
        "type": "toggle",
        "toggle": {
            "rich_text": [{"type":"text","text":{"content": f"#{o['num']} | {o['date']} | {o['item_count']} פריטים"}}],
            "children": [{"object":"block","type":"paragraph","paragraph":{
                "rich_text":[{"type":"text","text":{"content":items_text[:2000]}}]
            }}]
        }
    })

# Create page
print("Creating Notion page...")
page = api("POST", "pages", {
    "parent": {"page_id": ROOT},
    "icon": {"emoji": "🥬"},
    "properties": {"title": {"title": [{"text": {"content": "🥬 לקט השדה – ניתוח פריטים מלא"}}]}},
    "children": [
        callout(insight_text, "🧠", "green_background"),
        divider(),
        h1("🏆 Top 30 פריטים נפוצים"),
        p(top_text),
        divider(),
        h1("📦 פירוט הזמנות"),
    ]
})
page_id = page["id"]
print(f"Page: {page.get('url')}")

# Add order toggles in batches
for i in range(0, len(order_blocks), 90):
    batch = order_blocks[i:i+90]
    api("PATCH", f"blocks/{page_id}/children", {"children": batch})
    print(f"  Added {i+1}–{i+len(batch)}")

print(f"\n✅ Done: {page.get('url')}")
