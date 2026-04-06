import os
"""
Parse leket orders, analyze items, upload to Notion
"""
import json, re, urllib.request, urllib.error
from collections import defaultdict, Counter
from datetime import datetime

TOKEN = "os.environ['NOTION_TOKEN']"
ROOT = "3375d4e4-4f7f-8058-8626-c30c1e8421f4"

# ---- Load existing order summary ----
orders_summary = json.load(open("/Users/roni/.openclaw/workspace/leket/orders.json"))
order_dates = {}
for row in orders_summary["orders"][0]["rows"][1:]:
    if len(row) >= 2:
        order_dates[row[0]] = row[1]  # order_num -> date string

# ---- Parse detailed orders ----
detailed = json.load(open("/Users/roni/.openclaw/workspace/leket/orders_detailed.json"))

SKIP_ROWS = {"משלוח", "תשלום", "סה\"כ", "דמי משלוח", "", "מוצר"}

parsed_orders = []
item_counter = Counter()  # item_name -> total qty
item_orders = defaultdict(list)  # item_name -> [order_nums]

for order in detailed:
    num = order["orderNum"]
    date_str = order_dates.get(num, "")
    items = []
    
    for row in order.get("items", []):
        if len(row) < 3:
            continue
        name = row[1].strip() if len(row) > 1 else ""
        qty_str = row[2].strip() if len(row) > 2 else ""
        price_str = row[3].strip() if len(row) > 3 else ""
        total_str = row[4].strip() if len(row) > 4 else ""
        
        # Skip non-item rows
        if not name or any(skip in name for skip in SKIP_ROWS) or not qty_str:
            continue
        if name in ("מוצר", ""):
            continue
        
        # Parse quantity
        try:
            qty = float(qty_str.replace(",", "."))
        except:
            continue
        
        if qty <= 0:
            continue
            
        items.append({
            "name": name,
            "qty": qty,
            "price": price_str,
            "total": total_str
        })
        
        item_counter[name] += qty
        item_orders[name].append(num)
    
    parsed_orders.append({
        "num": num,
        "date": date_str,
        "items": items,
        "item_count": len(items)
    })

print(f"Parsed {len(parsed_orders)} orders")
print(f"Unique items: {len(item_counter)}")
print(f"\nTop 20 most ordered items:")
for name, qty in item_counter.most_common(20):
    count = len(item_orders[name])
    print(f"  {name}: {qty:.1f} units across {count} orders")

# ---- Notion API ----
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
        print(f"API Error {e.code}: {err[:200]}")
        raise

def p(text):
    return {"object":"block","type":"paragraph","paragraph":{"rich_text":[{"type":"text","text":{"content":str(text)[:2000]}}]}}

def h1(text):
    return {"object":"block","type":"heading_1","heading_1":{"rich_text":[{"type":"text","text":{"content":text}}]}}

def h2(text):
    return {"object":"block","type":"heading_2","heading_2":{"rich_text":[{"type":"text","text":{"content":text}}]}}

def callout(text, emoji="📊", color="blue_background"):
    return {"object":"block","type":"callout","callout":{"rich_text":[{"type":"text","text":{"content":str(text)[:2000]}}],"icon":{"emoji":emoji},"color":color}}

def divider():
    return {"object":"block","type":"divider","divider":{}}

# ---- Build analysis summary ----
total_orders = len(parsed_orders)
# Orders with valid dates
dated = [o for o in parsed_orders if o["date"]]
# Sort by date
def parse_date(d):
    try: return datetime.strptime(d[:8], "%d/%m/%y")
    except: return datetime.min

dated.sort(key=lambda o: parse_date(o["date"]))

# Date range
if dated:
    first_date = dated[0]["date"]
    last_date = dated[-1]["date"]
else:
    first_date = last_date = "?"

# Average items per order
avg_items = sum(o["item_count"] for o in parsed_orders) / max(len(parsed_orders), 1)

# Top items table
top_items_text = "פריט | כמות כוללת | מספר הזמנות\n"
for name, qty in item_counter.most_common(30):
    count = len(item_orders[name])
    top_items_text += f"{name} | {qty:.1f} | {count}\n"

# ---- Create Notion page ----
print("\n📄 Creating Notion analysis page...")

page = api("POST", "pages", {
    "parent": {"page_id": ROOT},
    "icon": {"emoji": "🥬"},
    "properties": {
        "title": {"title": [{"text": {"content": "🥬 לקט השדה – ניתוח פריטים מלא"}}]}
    },
    "children": [
        callout(f"ניתוח של {total_orders} הזמנות | {first_date} עד {last_date} | עודכן אוטומטית", "📊"),
        h1("📈 סיכום כללי"),
        p(f"סה\"כ הזמנות: {total_orders}\n"
          f"טווח תאריכים: {first_date} – {last_date}\n"
          f"ממוצע פריטים להזמנה: {avg_items:.1f}\n"
          f"סה\"כ מוצרים שונים שהוזמנו: {len(item_counter)}"),
        divider(),
        h1("🏆 הפריטים הנפוצים ביותר (Top 30)"),
        p(top_items_text),
        divider(),
        h1("📦 פירוט לפי הזמנה"),
    ]
})
page_id = page["id"]
print(f"Page: {page.get('url')}")

# ---- Add order details as sub-pages or blocks ----
# Add each order as a toggle/paragraph
order_blocks = []
for o in sorted(parsed_orders, key=lambda x: parse_date(x["date"]), reverse=True):
    if not o["items"]:
        continue
    items_text = "\n".join(f"• {it['name']}: {it['qty']} × {it['price']} = {it['total']}" for it in o["items"])
    block = {
        "object": "block",
        "type": "toggle",
        "toggle": {
            "rich_text": [{"type": "text", "text": {"content": f"הזמנה #{o['num']} | {o['date']} | {o['item_count']} פריטים"}}],
            "children": [
                {"object": "block", "type": "paragraph", "paragraph": {
                    "rich_text": [{"type": "text", "text": {"content": items_text[:2000]}}]
                }}
            ]
        }
    }
    order_blocks.append(block)

# Append in batches of 100 (Notion limit)
for i in range(0, len(order_blocks), 90):
    batch = order_blocks[i:i+90]
    api("PATCH", f"blocks/{page_id}/children", {"children": batch})
    print(f"  Added orders {i+1}–{i+len(batch)}")

print(f"\n✅ Done! Page: {page.get('url')}")

# Save parsed data locally too
json.dump({
    "orders": parsed_orders,
    "item_summary": [{"name": k, "total_qty": v, "num_orders": len(item_orders[k])} 
                     for k, v in item_counter.most_common()]
}, open("/Users/roni/.openclaw/workspace/leket/parsed_orders.json", "w"), ensure_ascii=False, indent=2)
print("Local JSON saved.")
