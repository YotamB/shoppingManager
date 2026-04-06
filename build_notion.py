import os
import json, urllib.request

TOKEN = "os.environ['NOTION_TOKEN']"
ROOT = "3375d4e4-4f7f-8058-8626-c30c1e8421f4"

def h1(text):
    return {"object":"block","type":"heading_1","heading_1":{"rich_text":[{"type":"text","text":{"content":text}}]}}

def h2(text):
    return {"object":"block","type":"heading_2","heading_2":{"rich_text":[{"type":"text","text":{"content":text}}]}}

def p(text):
    return {"object":"block","type":"paragraph","paragraph":{"rich_text":[{"type":"text","text":{"content":text}}]}}

def callout(text, emoji, color):
    return {"object":"block","type":"callout","callout":{"rich_text":[{"type":"text","text":{"content":text}}],"icon":{"emoji":emoji},"color":color}}

def divider():
    return {"object":"block","type":"divider","divider":{}}

children = [
    callout("שאלה: אם מריץ מק מיני 24/7 – מה כדאי? | עודכן: 4 אפריל 2026", "❓", "blue_background"),
    h1("📊 סיכום מהיר"),
    p("OpenClaw = agent אישי, תמיד דולק, מחובר לוואטסאפ/דיסקורד/טלגרם, זיכרון מתמשך, פועל אוטונומית\nClaude Cowork = כלי עבודה על שולחן העבודה, שולט במחשב, מתאים לעבודה פרונטלית בלבד"),
    h1("🔍 פירוט לפי קטגוריות"),

    h2("1. מהו כל מוצר?"),
    p("OpenClaw\nDaemon שרץ ברקע, מחובר ל-WhatsApp/Telegram/Discord/Slack. קוד פתוח, self-hosted, פועל 24/7, זיכרון מתמשך, heartbeats יזומים.\n\nClaude Cowork\nאפליקציית desktop של Anthropic (ינואר 2026). שולט ב-Mac/Windows – עכבר, מקלדת, דפדפן, Gmail. מתאים למי שיושב ליד המחשב."),
    divider(),

    h2("2. מודל שימוש"),
    p("OpenClaw\n• שולחים הודעה מכל מכשיר → Agent עובד ברקע → מדווח בסיום\n• פועל בלי שאתה ליד המחשב\n• Heartbeats: בודק דברים מיוזמתו ומתריע\n• מתאים לאוטומציות, ניטור, tasks ארוכי טווח\n\nClaude Cowork\n• נותנים פקודה בממשק כשיושבים ליד המחשב\n• Claude שולט בעכבר/מקלדת לביצוע\n• Task queuing – אפשר לתור משימות\n• לא פועל ברקע אוטומטית\n• לא שולח עדכונים לנייד"),
    divider(),

    h2("3. עלות"),
    p("OpenClaw\n• תוכנה: חינם (open source)\n• שימוש קל: ~$20-50/חודש (API בלבד)\n• שימוש כבד: $100-400/חודש\n• עלות לא ידועה מראש\n\nClaude Cowork\n• Pro: $20/חודש (מגבלות שימוש)\n• Max: $100-200/חודש (computer use מלא)\n• עלות קבועה וצפויה"),
    divider(),

    h2("4. אבטחה ופרטיות"),
    callout("Cowork: חולשת prompt injection נמצאה לפני launch – אפשרה גניבת קבצים דרך curl. דווחה 3 חודשים מראש ושוחררה בלי תיקון. אין audit logs. לא מתאים לנתונים רגישים.", "🔴", "red_background"),
    p("OpenClaw\n• הנתונים על המחשב שלך – self-hosted\n• קוד פתוח, ניתן לביקורת\n• הכי פרטי מבין השניים\n\nClaude Cowork\n• שרתי Anthropic (ענן)\n• חולשות אבטחה ידועות (research preview)\n• אין compliance API"),
    divider(),

    h2("5. זיכרון ורצף"),
    p("OpenClaw\n• זיכרון מלא: MEMORY.md + יומנים יומיים\n• זוכר החלטות, פרויקטים, העדפות לאורך חודשים\n\nClaude Cowork\n• אין זיכרון מתמשך – כל שיחה מאפס\n• אין learning מאינטראקציות קודמות"),
    divider(),

    h2("6. שליטה במחשב (Computer Use)"),
    p("OpenClaw\n• מריץ פקודות shell, קוד, scripts\n• שולט בדפדפן דרך Playwright (כמו שופרסל)\n• אין שליטה ב-GUI של אפליקציות\n\nClaude Cowork\n• שולט ממש בעכבר ומקלדת\n• פותח אפליקציות, מגלגל חלונות, גולש\n• Dispatch: שליטה מרחוק מהנייד\n• נוסף: מרץ 2026 – גם ל-Windows"),
    divider(),

    h2("7. אינטגרציות"),
    p("OpenClaw\n• 38+ integrations: WhatsApp, Telegram, Discord, Slack, iMessage\n• Notion, Google Calendar, GitHub, Jira, Apple Notes/Reminders\n• Skills ecosystem (ClawHub)\n\nClaude Cowork\n• Plugin ecosystem (productivity, sales, marketing)\n• Computer use: שליטה בכל GUI\n• Dispatch: גישה מרחוק מהנייד"),
    divider(),

    h1("🎯 המלצה: מק מיני שמריץ 24/7"),
    callout(
        "✅ תשאר עם OpenClaw.\n\n"
        "Cowork לא מתאים לריצה 24/7 ללא נוכחות – הוא דורש שתהיה ליד המחשב.\n"
        "OpenClaw הוא בדיוק ההפך: דולק, ממתין, פועל, מדווח.\n\n"
        "OpenClaw מנצח בתרחישים:\n"
        "• 'תזמין שופרסל בלילה'\n"
        "• 'תתריע כשמגיע אימייל חשוב'\n"
        "• 'תבדוק כל שעתיים ותשלח סיכום'\n"
        "• 'תריץ ניתוח ותשלח תוצאות לדיסקורד'\n\n"
        "Cowork היה עדיף אם:\n"
        "• רוצים שליטה ב-GUI (לפתוח תוכנות, לגלוש)\n"
        "• משימות חד-פעמיות כשיושבים ליד המחשב\n"
        "• לא רוצים התעסקות טכנית",
        "🏆", "green_background"
    ),

    h1("📋 טבלת השוואה"),
    p(
        "קטגוריה         | OpenClaw              | Claude Cowork\n"
        "Always-on 24/7   | ✅ כן                 | ❌ לא\n"
        "גישה מרחוק      | ✅ WhatsApp/Discord    | ❌ רק מהמחשב\n"
        "אוטונומיה        | ✅ גבוהה              | ❌ נמוכה\n"
        "זיכרון מתמשך    | ✅ כן                 | ❌ לא\n"
        "שליטה ב-GUI     | ❌ לא                 | ✅ כן\n"
        "עלות             | $20-400/חודש (API)    | $20-200/חודש (קבוע)\n"
        "התקנה            | טכנית                | קלה מאוד\n"
        "פרטיות           | ✅ Self-hosted        | ☁️ ענן\n"
        "Open source      | ✅ כן                 | ❌ לא\n"
        "אבטחה            | טובה                 | ⚠️ חולשות ידועות"
    ),
    p("מקורות: the-decoder.com, wired.com, venturebeat.com, adapt.com, reddit.com/r/ClaudeAI")
]

payload = {
    "parent": {"page_id": ROOT},
    "icon": {"emoji": "🤖"},
    "properties": {
        "title": {
            "title": [{"text": {"content": "🤖 OpenClaw vs Claude Cowork – השוואה (אפריל 2026)"}}]
        }
    },
    "children": children
}

data = json.dumps(payload).encode()
req = urllib.request.Request(
    "https://api.notion.com/v1/pages",
    data=data,
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }
)
with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read())
    print(result.get("url", "no url"))
