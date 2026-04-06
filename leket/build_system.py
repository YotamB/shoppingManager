import os
"""
Build Smart Leket system:
1. Base List DB in Notion
2. Item Memory DB in Notion  
3. Catalog Snapshots DB in Notion
4. Weekly Report page template
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
        print(f"API Error {e.code}: {err[:400]}")
        raise

def p(text): return {"object":"block","type":"paragraph","paragraph":{"rich_text":[{"type":"text","text":{"content":str(text)}}]}}
def h1(text): return {"object":"block","type":"heading_1","heading_1":{"rich_text":[{"type":"text","text":{"content":text}}]}}
def callout(text, emoji, color): return {"object":"block","type":"callout","callout":{"rich_text":[{"type":"text","text":{"content":str(text)}}],"icon":{"emoji":emoji},"color":color}}
def divider(): return {"object":"block","type":"divider","divider":{}}

# ---------------------------------------------------------------
# 1. Create parent hub page
# ---------------------------------------------------------------
print("📄 Creating Smart Leket hub page...")
hub = api("POST", "pages", {
    "parent": {"page_id": ROOT},
    "icon": {"emoji": "🥬"},
    "properties": {"title": {"title": [{"text": {"content": "🥬 Smart Leket – מערכת הזמנות"}}]}},
    "children": [
        callout("מערכת הזמנות חכמה מלקט השדה | כל ראשון ~9:00 תקבל דוח + לינק לNotionלאישור", "🤖", "green_background"),
        divider(),
        h1("📁 DBs"),
        p("Base List – רשימת בסיס"),
        p("Item Memory – זיכרון פריטים"),
        p("Catalog Snapshots – קטלוג שבועי"),
        p("Order History – היסטוריה ✅"),
        divider(),
        h1("📅 דוחות שבועיים"),
        p("הדוחות יופיעו כאן – כל ראשון"),
    ]
})
hub_id = hub["id"]
print(f"Hub: {hub.get('url')}")

# ---------------------------------------------------------------
# 2. Base List DB
# ---------------------------------------------------------------
print("\n📋 Creating Base List DB...")
base_db = api("POST", "databases", {
    "parent": {"page_id": hub_id},
    "title": [{"text": {"content": "📋 רשימת בסיס"}}],
    "properties": {
        "שם פריט": {"title": {}},
        "כמות ברירת מחדל": {"number": {"format": "number"}},
        "יחידה": {"select": {"options": [
            {"name": "יח'", "color": "blue"},
            {"name": "ק\"ג", "color": "green"},
            {"name": "מארז", "color": "purple"},
        ]}},
        "קטגוריה": {"select": {"options": [
            {"name": "🍎 פירות", "color": "red"},
            {"name": "🥦 ירקות", "color": "green"},
            {"name": "🌿 עשבים", "color": "brown"},
            {"name": "🧀 מוצרי חלב", "color": "yellow"},
            {"name": "🛒 אחר", "color": "gray"},
        ]}},
        "פעיל": {"checkbox": {}},
        "ממוצע היסטורי": {"number": {"format": "number"}},
        "הוזמן בX הזמנות": {"number": {"format": "number"}},
        "הערות": {"rich_text": {}},
    }
})
base_db_id = base_db["id"]
print(f"Base List DB: {base_db_id}")

# ---------------------------------------------------------------
# 3. Populate Base List from history
# ---------------------------------------------------------------
STAPLES = [
    ("תפוח עץ פינק ליידי", 2.0, "יח'", "🍎 פירות", 2.4, 37),
    ("בננה", 2.0, "יח'", "🍎 פירות", 2.1, 37),
    ("אגס", 1.0, "יח'", "🍎 פירות", 0.9, 37),
    ("סימפונית שרי מארז", 1.0, "מארז", "🍎 פירות", 1.4, 37),
    ("לבבות חסה שטוף מארז", 1.0, "מארז", "🥦 ירקות", 1.4, 37),
    ("מלפפון חממה", 2.0, "יח'", "🥦 ירקות", 2.1, 34),
    ("פלפל אדום", 1.0, "יח'", "🥦 ירקות", 0.8, 36),
    ("פלפל צהוב", 1.0, "יח'", "🥦 ירקות", 0.7, 31),
    ("פלפל כתום", 1.0, "יח'", "🥦 ירקות", 0.6, 26),
    ("בטטה מובחרת", 2.0, "ק\"ג", "🥦 ירקות", 2.2, 29),
    ("יוגורט עיזים", 2.0, "יח'", "🧀 מוצרי חלב", 2.2, 32),
]

print("Adding staples to Base List...")
for name, qty, unit, cat, avg, orders_count in STAPLES:
    api("POST", "pages", {
        "parent": {"database_id": base_db_id},
        "properties": {
            "שם פריט": {"title": [{"text": {"content": name}}]},
            "כמות ברירת מחדל": {"number": qty},
            "יחידה": {"select": {"name": unit}},
            "קטגוריה": {"select": {"name": cat}},
            "פעיל": {"checkbox": True},
            "ממוצע היסטורי": {"number": avg},
            "הוזמן בX הזמנות": {"number": orders_count},
        }
    })
    print(f"  ✓ {name}")

# ---------------------------------------------------------------
# 4. Item Memory DB
# ---------------------------------------------------------------
print("\n🧠 Creating Item Memory DB...")
memory_db = api("POST", "databases", {
    "parent": {"page_id": hub_id},
    "title": [{"text": {"content": "🧠 זיכרון פריטים"}}],
    "properties": {
        "פריט": {"title": {}},
        "הערה": {"rich_text": {}},
        "לא להזמין עד": {"date": {}},
        "מצב": {"select": {"options": [
            {"name": "⏳ בהמתנה", "color": "yellow"},
            {"name": "✅ הושלם", "color": "green"},
            {"name": "❌ לא להזמין", "color": "red"},
        ]}},
        "נוצר": {"date": {}},
        "מקור": {"rich_text": {}},
    }
})
memory_db_id = memory_db["id"]
print(f"Memory DB: {memory_db_id}")

# ---------------------------------------------------------------
# 5. Catalog Snapshots DB
# ---------------------------------------------------------------
print("\n📸 Creating Catalog Snapshots DB...")
catalog_db = api("POST", "databases", {
    "parent": {"page_id": hub_id},
    "title": [{"text": {"content": "📸 קטלוג שבועי"}}],
    "properties": {
        "שם פריט": {"title": {}},
        "מחיר": {"rich_text": {}},
        "זמין": {"checkbox": {}},
        "חדש השבוע": {"checkbox": {}},
        "קטגוריה": {"rich_text": {}},
        "תאריך סריקה": {"date": {}},
        "URL": {"url": {}},
    }
})
catalog_db_id = catalog_db["id"]
print(f"Catalog DB: {catalog_db_id}")

# ---------------------------------------------------------------
# 6. Save DB IDs to config file
# ---------------------------------------------------------------
config = {
    "hub_page_id": hub_id,
    "hub_url": hub.get("url"),
    "base_list_db_id": base_db_id,
    "memory_db_id": memory_db_id,
    "catalog_db_id": catalog_db_id,
    "order_history_page_id": "3395d4e44f7f81b1993ffc29e4ef0edb",
    "notion_token": TOKEN,
    "notion_root": ROOT,
    "schedule": "sunday 09:00",
    "timezone": "Asia/Jerusalem",
}
with open("/Users/roni/.openclaw/workspace/leket/config.json", "w") as f:
    json.dump(config, f, ensure_ascii=False, indent=2)

print(f"\n✅ System built!")
print(f"Hub: {hub.get('url')}")
print(f"Base List DB: {base_db_id}")
print(f"Memory DB: {memory_db_id}")
print(f"Catalog DB: {catalog_db_id}")
print(f"Config saved to leket/config.json")
