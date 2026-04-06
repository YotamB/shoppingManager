import os
import json, urllib.request, urllib.error

TOKEN = "os.environ['NOTION_TOKEN']"
PAGE_ID = "3385d4e44f7f81aa84aec89ade6e758b"

def p(text):
    return {"object":"block","type":"paragraph","paragraph":{"rich_text":[{"type":"text","text":{"content":text}}]}}

def h1(text):
    return {"object":"block","type":"heading_1","heading_1":{"rich_text":[{"type":"text","text":{"content":text}}]}}

def h2(text):
    return {"object":"block","type":"heading_2","heading_2":{"rich_text":[{"type":"text","text":{"content":text}}]}}

def callout(text, emoji, color):
    return {"object":"block","type":"callout","callout":{"rich_text":[{"type":"text","text":{"content":text}}],"icon":{"emoji":emoji},"color":color}}

def divider():
    return {"object":"block","type":"divider","divider":{}}

new_blocks = [
    divider(),
    callout("עדכון: 4 אפריל 2026 – Dispatch משנה את התמונה", "🆕", "yellow_background"),
    h1("עדכון: Claude Dispatch (מרץ 2026)"),
    p(
        "ב-17 מרץ 2026 Anthropic שחררו את Dispatch – פיצ'ר שמגשר על הפער המרכזי בין Cowork ל-OpenClaw.\n\n"
        "מה Dispatch עושה:\n"
        "- שיחה מתמשכת אחת בין נייד לדסקטופ – לא מתאפסת בין sessions\n"
        "- שולחים task מהאייפון → Claude עובד על המחשב הביתי → push notification כשמסיים\n"
        "- זיכרון מתמשך: Claude זוכר פרויקטים, העדפות, הקשר\n"
        "- Scheduled tasks: 'בדוק מייל כל בוקר', 'שלח דוח כל שישי' – מגדירים פעם אחת\n"
        "- Computer Use מהנייד: אפשר לבקש מהנייד ש-Claude יפתח Excel על המחשב\n"
        "- Claude Code sessions: tasks פיתוח רצים ב-Claude Code, שאר ב-Cowork"
    ),
    h2("השוואה מעודכנת לאחר Dispatch"),
    p(
        "קטגוריה              | OpenClaw              | Cowork + Dispatch\n"
        "Always-on 24/7        | כן (daemon)           | כן (צריך מחשב דולק)\n"
        "גישה מהנייד          | WhatsApp/Discord       | Claude iOS/Android\n"
        "אוטונומיה             | גבוהה                 | גבוהה (חדש!)\n"
        "זיכרון מתמשך         | כן                    | כן (חדש!)\n"
        "Scheduled tasks       | Heartbeats/Cron        | כן (חדש!)\n"
        "Push notifications    | דרך Discord/WA         | native push\n"
        "שליטה ב-GUI           | לא                    | כן (Computer Use)\n"
        "עלות                  | $20-400/חודש API       | $100-200/חודש Max\n"
        "התקנה                 | טכנית                 | קלה מאוד\n"
        "פרטיות                | Self-hosted            | ענן\n"
        "Open source           | כן                    | לא\n"
        "אבטחה                 | טובה                  | חולשות ידועות"
    ),
    h2("המלצה מעודכנת"),
    callout(
        "הפער בין השניים קטן מאוד אחרי Dispatch. עכשיו זה תלוי בפרופיל:\n\n"
        "תישאר עם OpenClaw אם:\n"
        "- רוצה self-hosted ושליטה מלאה על הנתונים\n"
        "- פרטיות מקסימלית חשובה לך\n"
        "- שימוש כבד שיכול להיות זול יותר ב-API ישיר\n"
        "- אהבת לקבל הודעות ב-WhatsApp/Discord\n\n"
        "שקול לעבור ל-Cowork + Dispatch אם:\n"
        "- רוצה computer use מלא (GUI, Excel, Gmail)\n"
        "- מעדיף חוויה ללא תחזוקה טכנית\n"
        "- Push notifications נייטיב חשוב לך\n"
        "- מוכן לשלם $100-200 לחודש על Max\n\n"
        "הסתייגות: חולשת האבטחה של Cowork (prompt injection + גניבת קבצים) עדיין לא תוקנה רשמית.",
        "🎯", "purple_background"
    ),
    p("מקורות לעדכון: support.claude.com, forbes.com, ndtv.com (מרץ-אפריל 2026)")
]

data = json.dumps({"children": new_blocks}).encode()
req = urllib.request.Request(
    f"https://api.notion.com/v1/blocks/{PAGE_ID}/children",
    data=data,
    method="PATCH",
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }
)
try:
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
        print("OK:", len(result.get("results", [])), "blocks added")
except urllib.error.HTTPError as e:
    print("Error:", e.code, e.read().decode())
