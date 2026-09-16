# החרזן של בן יהודה

כלי חינמי למציאת חרוזים בעברית לכתיבת שירים. מקליד מילה, מקבל מילים שמתחרזות איתה
לפי דמיון צליל אמיתי (לא רק אותיות דומות בכתיב).

אתר סטטי בלבד - `index.html` + `css/styles.css` + `js/words.js` + `js/app.js`. אין בנייה, אין שרת.

## הרצה מקומית

פשוט לפתוח את `index.html` בדפדפן. אם רוצים שרת מקומי (לא חובה):

```powershell
python -m http.server 8850
```

## פריסה (Deploy) ל-GitHub Pages

1. לוודא שכל השינויים מקומיים commit-ו: `git add -A && git commit -m "..."`.
2. `git push` (ה-remote כבר מוגדר ל-`origin` על `avichaibel/haroozim`).
3. ב-GitHub: Settings → Pages → Source: `Deploy from a branch`, Branch: `main` / `(root)`.
4. האתר יהיה זמין בכתובת `https://avichaibel.github.io/haroozim/` תוך דקה-שתיים.

אם בעתיד יעבור לדומיין אישי, יש לעדכן את `<link rel="canonical">` וה-`og:url` ב-`index.html`,
את `robots.txt` ואת `sitemap.xml`.

## Google AdSense

1. יש להירשם באופן עצמאי בכתובת https://www.google.com/adsense ולאמת את הבעלות על האתר.
2. AdSense דורש תוכן אמיתי ותנועה סבירה לפני אישור - זה עלול לקחת זמן.
3. לאחר אישור, לקבל מ-AdSense: מזהה מפרסם (`ca-pub-...`) ומזהי חריצי מודעות (slot ids).
4. למלא אותם ב-`js/app.js` במשתנים `ADSENSE_CLIENT` ו-`ADSENSE_SLOTS` שבתחילת הקובץ.
5. חריצי המודעות עצמם (`<div class="ad-slot">`) כבר קיימים ב-`index.html` - למעלה ולמטה בעמוד.
   כל עוד `ADSENSE_CLIENT` ריק, יוצג שם placeholder בלבד ולא ייטענו מודעות אמיתיות.
6. המודעות ייטענו רק אחרי שמבקר לוחץ "הבנתי, אישרתי" בבאנר העוגיות (עמידה ב-GDPR).

## קידום אורגני (SEO)

- יש כבר תגיות `<title>`, `description`, `og:*`, `robots.txt` ו-`sitemap.xml` בסיסיים.
- אחרי הפריסה כדאי לרשום את האתר ב-Google Search Console (search.google.com/search-console),
  להגיש את ה-sitemap, ולבדוק שאין שגיאות אינדוקס.
- תוכן איכותי ומקורי (כמו קטע "איך הכלי עובד" שכבר קיים בעמוד) עוזר גם לדירוג וגם לאישור AdSense.
- קישורים נכנסים מפורומים/קבוצות פייסבוק/רדיט של כותבי שירים יעזרו לקידום האורגני.
