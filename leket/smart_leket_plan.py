import os
"""Create Smart Leket planning note in Notion"""
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
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def p(text): return {"object":"block","type":"paragraph","paragraph":{"rich_text":[{"type":"text","text":{"content":str(text)}}]}}
def h1(text): return {"object":"block","type":"heading_1","heading_1":{"rich_text":[{"type":"text","text":{"content":text}}]}}
def h2(text): return {"object":"block","type":"heading_2","heading_2":{"rich_text":[{"type":"text","text":{"content":text}}]}}
def h3(text): return {"object":"block","type":"heading_3","heading_3":{"rich_text":[{"type":"text","text":{"content":text}}]}}
def callout(text, emoji, color): return {"object":"block","type":"callout","callout":{"rich_text":[{"type":"text","text":{"content":text}}],"icon":{"emoji":emoji},"color":color}}
def divider(): return {"object":"block","type":"divider","divider":{}}
def bullet(text): return {"object":"block","type":"bulleted_list_item","bulleted_list_item":{"rich_text":[{"type":"text","text":{"content":text}}]}}
def numbered(text): return {"object":"block","type":"numbered_list_item","numbered_list_item":{"rich_text":[{"type":"text","text":{"content":text}}]}}
def todo(text, checked=False): return {"object":"block","type":"to_do","to_do":{"rich_text":[{"type":"text","text":{"content":text}}],"checked":checked}}

page = api("POST", "pages", {
    "parent": {"page_id": ROOT},
    "icon": {"emoji": "📋"},
    "properties": {"title": {"title": [{"text": {"content": "📋 Smart Leket – תוכנית מערכת הזמנות חכמה"}}]}},
    "children": [

        callout("טיוטה לאישור – לפני שמתחילים לבנות. סמן ✅ על מה שמאשרים, הוסף הערות על מה שרוצים לשנות.", "📝", "yellow_background"),
        divider(),

        # ---- GOALS ----
        h1("🎯 מטרת המערכת"),
        p("מערכת שמנהלת את ההזמנה השבועית מלקט השדה באופן חצי-אוטומטי. כל ראשון בבוקר מקבלים המלצת הזמנה מותאמת אישית – מבוססת על רשימת בסיס, מה זמין עכשיו, ומה זכרתי מהשבועות הקודמים. מאשרים בדיסקורד, ורוני שולח."),
        divider(),

        # ---- ARCHITECTURE ----
        h1("🏗️ ארכיטקטורה – 3 שכבות"),

        h2("1. Base List – רשימת בסיס"),
        p("מה זה: הפריטים שאתה קונה כמעט תמיד, עם כמות ברירת מחדל."),
        p("איפה: Notion DB (Base List) – ניתן לערוך בעצמך בכל עת."),
        p("מה יש בו: פריט | כמות ברירת מחדל | קטגוריה (פרי/ירק/עשב/אחר) | פעיל? (כן/לא)"),
        p("איך נמלא אותו: אני אייבא אוטומטית מהפריטים שהוזמנו ב-30+ מתוך 40 הזמנות (הסטייפלס שלך). תבדוק ותאשר/תמחק."),

        divider(),

        h2("2. Catalog Scanner – סריקת קטלוג"),
        p("מה זה: סקריפט שרץ כל ראשון בבוקר ומשווה את האתר לרשימת הבסיס."),
        p("מה הוא עושה:"),
        bullet("נכנס לאתר + מתחבר"),
        bullet("שולף את כל הפריטים הזמינים + מחירים"),
        bullet("מזהה: מה חדש שלא היה בסריקה הקודמת"),
        bullet("מזהה: מה חסר מהרשימה שלך (לא זמין)"),
        bullet("מזהה: מה חזר אחרי שהיה חסר"),
        bullet("שומר Snapshot ב-Notion (פריט, מחיר, זמין?, תאריך)"),

        divider(),

        h2("3. Memory Engine – זיכרון ומעקב"),
        p("מה זה: DB שמנהל הערות על פריטים + מחכה להנחיות שלך."),
        p("מה יש בו: פריט | הערה | 'לא להזמין עד' | מצב (פעיל/הושלם)"),
        p("איך מוסיפים הערה: אתה אומר לי בדיסקורד למשל 'ענבים לא טעימים, לחכות 3 שבועות' ואני שומר."),
        p("דוגמאות לשימוש:"),
        bullet("'אפרסמון לא טעים – להמתין עד 1/5'"),
        bullet("'ענבים אדומים – הזמנתי בפעם הראשונה, עדיין לא בשלו'"),
        bullet("'פסיפלורה – הוסף לרשימת הבסיס מעכשיו'"),

        divider(),

        # ---- WEEKLY FLOW ----
        h1("⏰ Flow שבועי – כל ראשון"),

        h2("שלב 1: סריקה (8:00)"),
        numbered("סריקת קטלוג לקט השדה – מה זמין, מה חדש, מה חסר"),
        numbered("השוואה לרשימת בסיס"),
        numbered("בדיקת Memory – יש הערות פעילות? (ענבים בהמתנה, אפרסמון חסר)"),
        numbered("חישוב המלצה מבוססת ממוצעים היסטוריים"),

        h2("שלב 2: הדוח (8:30)"),
        p("אני שולח לך בדיסקורד דוח כזה:"),
        callout(
            "🥬 המלצת הזמנה – ראשון [תאריך]\n\n"
            "📋 רשימת בסיס (אין שינוי):\n"
            "• תפוח פינק ליידי × 3 יח' | 8.90 ₪/ק\"ג\n"
            "• בננה × 2 יח' | 7.90 ₪/ק\"ג\n"
            "• מלפפון חממה × 2 יח' | ...\n"
            "...\n\n"
            "🆕 חדש השבוע / עונתי:\n"
            "• פסיפלורה – חדשה! לא הזמנת מעולם. רוצה להוסיף?\n"
            "• תפוזים – חזרו למלאי\n\n"
            "⚠️ שינויים:\n"
            "• אפרסמון – אין במלאי. ממוצע שלך: 1 ק\"ג. המלצה: קיווי/שזיפים במקום?\n"
            "• ענבים שחורים – בהמתנה (הערה: 'לא טעימים'). עוד 2 שבועות.\n\n"
            "💰 הערכת סכום: ~580 ₪\n\n"
            "➡️ ענה: 'אשר' | 'ערוך: [שינויים]' | 'בטל השבוע'",
            "🥬", "green_background"
        ),

        h2("שלב 3: אישור ושליחה"),
        p("אחרי שאתה מאשר (בדיסקורד) – Playwright נכנס לאתר ומוסיף לעגלה ומבצע הזמנה."),
        p("אם אמרת 'ערוך' – אני מעדכן ושולח גרסה מתוקנת לאישור נוסף."),

        divider(),

        # ---- NOTION STRUCTURE ----
        h1("🗄️ מבנה Notion"),

        h2("DB 1: Base List (רשימת בסיס)"),
        p("עמודות: שם פריט | כמות | יחידה (ק\"ג/יח') | קטגוריה | פעיל? | הערות"),
        p("מתמלא: אוטומטית מהיסטוריה + אתה מאשר"),

        h2("DB 2: Item Memory (זיכרון פריטים)"),
        p("עמודות: שם פריט | הערה | 'לא להזמין עד' | נוצר | מצב"),
        p("מתמלא: כשאתה אומר לי משהו על פריט"),

        h2("DB 3: Catalog Snapshots (קטלוג שבועי)"),
        p("עמודות: שם פריט | מחיר | זמין? | חדש? | תאריך סריקה"),
        p("מתמלא: אוטומטית כל ראשון"),

        h2("DB 4: Order History (היסטוריה) ✅"),
        p("כבר קיים – 40 הזמנות עם פרטי פריטים"),

        divider(),

        # ---- DECISIONS NEEDED ----
        h1("❓ שאלות לאישורך"),

        callout("אנא סמן ✅ או הוסף הערות על כל נקודה", "👇", "blue_background"),

        h2("א. מתי לשלוח את הדוח?"),
        todo("ראשון בבוקר ~8:00-9:00"),
        todo("ראשון ~10:00 (אחרי כוס קפה 😄)"),
        todo("שבת בלילה (כדי שתהיה מוכן לראשון)"),

        h2("ב. אישור לפני שליחה?"),
        todo("כן – תמיד אישור ידני לפני שליחת הזמנה לאתר"),
        todo("לא – אם לא ענית תוך שעה → שלח אוטומטית"),

        h2("ג. רשימת בסיס – מה להכניס אוטומטית?"),
        todo("הפריטים שהוזמנו ב-30+/40 הזמנות (7-8 פריטים ידרשו אישורך)"),
        todo("כל הפריטים שהוזמנו ב-20+ הזמנות (הרבה יותר)"),
        todo("נתחיל עם רשימה ריקה ואני אציע אחת לאישורך"),

        h2("ד. איפה לתת הערות על פריטים?"),
        todo("דיסקורד – אני קולט ושומר"),
        todo("Notion – עריכה ישירה ב-DB"),
        todo("שניהם"),

        h2("ה. שמות פריטים באתר שהשתנו"),
        todo("אני מנהל mapping אוטומטי (ענבים = ענבים שחורים טלי לק\"ג)"),
        todo("ידני – אתה תגיד לי אם משהו לא מזוהה"),

        divider(),

        # ---- TIMELINE ----
        h1("📅 תכנית בנייה"),
        numbered("בניית Notion DBs (Base List, Memory, Catalog)"),
        numbered("ייבוא רשימת בסיס ראשונית מהיסטוריה"),
        numbered("סקריפט סריקת קטלוג"),
        numbered("Cron job – כל ראשון"),
        numbered("לוגיקת המלצות + דוח בדיסקורד"),
        numbered("שליחת הזמנה לאתר (Playwright)"),
        numbered("Memory engine – קריאת הערות מדיסקורד"),

        p("~3-4 שעות עבודה בסך הכל. ניתן לבנות בשלבים."),
        divider(),
        p("עדכן את הפתק עם הערות/אישורים ואז אתחיל לבנות 🚀"),
    ]
})
print(f"✅ Page: {page.get('url')}")
