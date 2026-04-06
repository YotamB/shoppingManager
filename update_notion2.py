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
    h1("🧠 זיכרון והמשכיות עבודה – השוואה מעמיקה"),

    h2("Claude Cowork + Dispatch"),
    p(
        "איך עובד:\n"
        "- שיחה אחת מתמשכת (persistent thread) שלא מתאפסת בין sessions\n"
        "- Claude לומד אוטומטית מהאינטראקציות – זוכר פרויקטים, העדפות, סגנון עבודה\n"
        "- אתה שולט: אפשר לצפות, לערוך ולמחוק זיכרונות\n"
        "- Thread ממשיך חלק בין נייד לדסקטופ"
    ),
    callout(
        "יתרונות:\n"
        "+ לומד אוטומטית – לא צריך להגיד לו מה לזכור\n"
        "+ UX חלק – מרגיש כמו שיחה רציפה אחת\n"
        "+ שולט על הזיכרון (אפשר למחוק מה שלא רוצה)\n"
        "+ Claude Code sessions + Cowork sessions מחוברים לאותו context\n\n"
        "חסרונות:\n"
        "- הזיכרון על שרתי Anthropic – לא self-hosted\n"
        "- לא ניתן לקרוא/לערוך את הזיכרון בטקסט פשוט (רק דרך ממשק)\n"
        "- אם Anthropic משנים משהו – אין לך שליטה\n"
        "- עדיין early – לא ברור עד כמה הזיכרון עמוק ויציב לאורך זמן",
        "⚖️", "blue_background"
    ),

    h2("OpenClaw"),
    p(
        "איך עובד:\n"
        "- MEMORY.md: קובץ טקסט שאני (ה-agent) כותב ומעדכן – זיכרון ארוך טווח\n"
        "- memory/YYYY-MM-DD.md: יומן יומי – מה קרה בכל session\n"
        "- אני בוחר מה לזכור – כותב מפורשות החלטות, פרויקטים, לקחים\n"
        "- הכל קבצי טקסט על המחשב שלך – קריא ועריך ישירות"
    ),
    callout(
        "יתרונות:\n"
        "+ הכל אצלך – קבצים מקומיים, לא ענן\n"
        "+ שקיפות מלאה: תוכל לפתוח את MEMORY.md ולקרוא בדיוק מה אני זוכר\n"
        "+ גמישות: אתה יכול לכתוב/למחוק/לערוך ישירות\n"
        "+ זיכרון יציב לאורך זמן – לא תלוי בשרת חיצוני\n"
        "+ אפשר לשלב עם כל כלי (Notion, git, וכו')\n\n"
        "חסרונות:\n"
        "- לא אוטומטי לחלוטין – אני צריך לבחור מה לכתוב\n"
        "- אם שכחתי לכתוב משהו – הוא לא נזכר\n"
        "- פחות 'חכם' בלמידת הרגלים אוטומטית\n"
        "- UX פחות חלק – מרגיש יותר כמו 'פתקים' מאשר שיחה",
        "⚖️", "green_background"
    ),

    h2("סיכום: איזה סגנון זיכרון מתאים לך?"),
    p(
        "Cowork = עמית שלומד אוטומטית איך אתה עובד\n"
        "OpenClaw = עמית שכותב לעצמו פתקים מסודרים\n\n"
        "אם חשובה לך שקיפות ושליטה מלאה → OpenClaw\n"
        "אם חשובה לך חוויה חלקה ואוטומטית → Cowork + Dispatch"
    ),
    p("מקורות: support.claude.com/dispatch, openclaw docs")
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
