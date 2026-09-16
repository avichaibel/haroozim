// ============================================================
// כלי חרוזים - מוצא מילים מתחרזות בעברית
// ללא בנייה, ללא שרת - קובץ סטטי בלבד.
// ============================================================

var LS_CUSTOM_WORDS = "haroozim_custom_words_v1";
var LS_ANT_KEY = "haroozim_ant_key_v1";
var LS_HISTORY = "haroozim_history_v1";
var LS_FAVORITES = "haroozim_favorites_v1";
var LS_COOKIE_CONSENT = "haroozim_cookie_consent_v1";

// -------- Google AdSense (ממתין לאישור) --------
// אחרי שתאושרו ב-AdSense, מלאו כאן את מזהה המפרסם (ca-pub-XXXXXXXXXXXXXXXX)
// ואת מזהי חריצי המודעות שתקבלו, ותורידו את ה-comment מהקוד בפונקציה loadAdsense().
var ADSENSE_CLIENT = "ca-pub-2024925916431434";
var ADSENSE_SLOTS = { top: "", bottom: "" };

// -------- Google Analytics (GA4) --------
var GA_MEASUREMENT_ID = "G-M5WPDWXFD2";

// מצב תצוגה נוכחי (לא נשמר - חוזר לברירת מחדל בכל טעינה)
var state = {
  word: "",
  results: [],
  showWeak: false, // מצב "רופף": מציג גם חרוזי סיומת בלבד
  lengthFilter: "all", // all | vshort | short | medium | long
  expandedGroups: {}, // אילו קבוצות (perfect/strong/medium/weak) המשתמש לחץ "הצג עוד" עליהן
};
var RESULTS_PAGE_SIZE = 60; // כמה חרוזים להציג בכל קבוצה לפני "הצג עוד" (למילים נפוצות כמו "-ים" יכולים להיות אלפי חרוזים)

// -------- ניקוד/תבניות עזר --------
var NIQQUD_RE = /[֑-ׇ]/g;

// אותיות סופיות -> אותיות רגילות (הצליל זהה)
var FINAL_LETTERS = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

// קבוצות אותיות שנשמעות כמעט זהה בעברית מדוברת - התאמה "מלאה" (ניקוד גבוה)
var EXACT_GROUPS = [
  ["כ", "ק", "ח"],
  ["ט", "ת"],
];

// זוגות אותיות שנשמעות דומה אך לא זהות - התאמה "חלקית" (ניקוד נמוך יותר)
var PARTIAL_PAIRS = [
  ["א", "ע"],
  ["ס", "ש"],
  ["ה", "א"],
];

var GROUP_OF = {};
EXACT_GROUPS.forEach(function (g, gi) {
  g.forEach(function (ch) { GROUP_OF[ch] = "E" + gi; });
});
var PARTIAL_OF = {};
PARTIAL_PAIRS.forEach(function (pair) {
  var a = pair[0], b = pair[1];
  PARTIAL_OF[a] = PARTIAL_OF[a] || {};
  PARTIAL_OF[a][b] = true;
  PARTIAL_OF[b] = PARTIAL_OF[b] || {};
  PARTIAL_OF[b][a] = true;
});

function normalizeWord(raw) {
  if (!raw) return "";
  var w = raw.trim().replace(NIQQUD_RE, "");
  // מסירים תווים שאינם אותיות עבריות (רווחים, פיסוק וכו')
  w = w.replace(/[^א-ת]/g, "");
  return w;
}

function letterMatchScore(a, b) {
  if (a === b) return 3;
  if (GROUP_OF[a] && GROUP_OF[a] === GROUP_OF[b]) return 2;
  if (PARTIAL_OF[a] && PARTIAL_OF[a][b]) return 1;
  return 0;
}

// משווה את סופי שתי המילים לפי אותיות בלבד (מהסוף להתחלה) ומחזיר {score, runLength}.
// זו שיטת הגיבוי - משמשת רק כשאין נתוני ניקוד לאחת המילים (למשל מילה אישית חדשה).
function rhymeScoreLetters(word, candidate) {
  var w = normalizeWord(word);
  var c = normalizeWord(candidate);
  if (!w || !c) return { score: 0, runLength: 0 };
  if (w === c) return { score: -1, runLength: 0 }; // אותה מילה בדיוק - לא מציעים

  var vavHints = window.HAROOZIM_VAV_HINT || {};
  var hintW = vavHints[w];
  var hintC = vavHints[c];

  var i = w.length - 1;
  var j = c.length - 1;
  var score = 0;
  var runLength = 0;

  while (i >= 0 && j >= 0) {
    var la = w[i];
    var lb = c[j];
    var la2 = FINAL_LETTERS[la] || la;
    var lb2 = FINAL_LETTERS[lb] || lb;
    var s = letterMatchScore(la2, lb2);
    // ו' יכולה להישמע "אוֹ" (חולם) או "אוּ" (שורוק) - אם ידוע ששתי המילים נשמעות אחרת שם, זה לא באמת חרוז
    if (s > 0 && la2 === "ו" && lb2 === "ו" && hintW && hintC && hintW !== hintC) {
      s = 0;
    }
    if (s === 0) break;
    score += s;
    runLength += 1;
    i -= 1;
    j -= 1;
  }
  return { score: score, runLength: runLength, method: "letters" };
}

// -------- השוואה פונטית (מבוססת ניקוד אמיתי, ולא רק אותיות) --------
// window.HAROOZIM_PHONETIC ממופה מילה -> מחרוזת מפתח מהצורה "עיצור1 קוד-תנועה1 עיצור2 קוד-תנועה2 ..."
// (כל יחידה = 2 תווים; קוד תנועה הוא a/e/i/o/u או "_" לחוסר תנועה/שוואית). נבנה מראש מניקוד אמיתי
// (Dicta Nakdan API), כך שהאלגוריתם משווה צליל אמיתי (כולל התנועה) ולא רק אותיות.
function parsePhoneticKey(key) {
  var units = [];
  for (var i = 0; i < key.length; i += 2) {
    units.push({ letter: key[i], vowel: key[i + 1] });
  }
  return units;
}

var _phoneticUnitsCache = {};
function getPhoneticUnits(word) {
  if (_phoneticUnitsCache[word] !== undefined) return _phoneticUnitsCache[word];
  var table = window.HAROOZIM_PHONETIC;
  var key = table ? table[word] : null;
  var units = key ? parsePhoneticKey(key) : null;
  _phoneticUnitsCache[word] = units;
  return units;
}

function rhymeScorePhonetic(unitsW, unitsC) {
  var i = unitsW.length - 1;
  var j = unitsC.length - 1;
  var score = 0;
  var runLength = 0;
  var exactRun = 0; // כמה יחידות ברצף *מהסוף* התאימו גם בעיצור וגם בתנועה (חרוז "מלא", לא רק קרוב)
  var stillExact = true; // ברגע שהברה אחת לא תואמת בול, כל מה שלפניה כבר לא נספר כ"רצף מושלם"

  while (i >= 0 && j >= 0) {
    var ua = unitsW[i];
    var ub = unitsC[j];
    var la = FINAL_LETTERS[ua.letter] || ua.letter;
    var lb = FINAL_LETTERS[ub.letter] || ub.letter;
    var consonantScore = letterMatchScore(la, lb);
    // עיצורים שלא נשמעים דומה בכלל - זה מספיק כדי לעצור (גם אם התנועה במקרה זהה)
    if (consonantScore === 0) break;
    var vowelMatch = ua.vowel === ub.vowel;
    // אם התנועה שונה זה לא "חרוז מלא" באותה הברה, אבל עדיין יכול להיות חרוז קרוב/עיצורי -
    // ממשיכים את הרצף עם ניקוד חלקי, במקום לעצור לגמרי (כדי לא לאבד זוגות כמו שלום/עולם)
    score += consonantScore + (vowelMatch ? 3 : 0);
    if (stillExact && vowelMatch && consonantScore === 3) {
      exactRun += 1;
    } else {
      stillExact = false;
    }
    runLength += 1;
    i -= 1;
    j -= 1;
  }
  return { score: score, runLength: runLength, exactRun: exactRun, method: "phonetic" };
}

// משווה שתי מילים ומחזיר {score, runLength} - משתמש בניקוד אמיתי כשיש לשתי המילים נתוני ניקוד,
// ונופל חזרה להשוואת אותיות בלבד אחרת (למשל מילים אישיות שהמשתמש הוסיף).
function rhymeScore(word, candidate) {
  var w = normalizeWord(word);
  var c = normalizeWord(candidate);
  if (!w || !c) return { score: 0, runLength: 0 };
  if (w === c) return { score: -1, runLength: 0 };

  var unitsW = getPhoneticUnits(w);
  var unitsC = getPhoneticUnits(c);
  if (unitsW && unitsC) {
    return rhymeScorePhonetic(unitsW, unitsC);
  }
  return rhymeScoreLetters(w, c);
}

function rhymeStrength(result) {
  if (result.method === "phonetic") {
    // exactRun = כמה יחידות ברצף מתאימות גם בעיצור וגם בתנועה (חרוז מלא, לא רק קרוב)
    if (result.exactRun >= 2) return { label: "חרוז מושלם", cls: "perfect" };
    if (result.exactRun >= 1 && result.runLength >= 2) return { label: "חרוז חזק", cls: "strong" };
    if (result.exactRun >= 1) return { label: "חרוז בינוני", cls: "medium" };
    if (result.runLength >= 2) return { label: "חרוז קרוב", cls: "medium" };
    return { label: "חרוז רחוק", cls: "weak" };
  }
  // גיבוי מבוסס אותיות בלבד (למילים בלי נתוני ניקוד, כמו מילים אישיות חדשות)
  if (result.runLength >= 4 && result.score >= 10) return { label: "חרוז מושלם", cls: "perfect" };
  if (result.runLength >= 3 && result.score >= 7) return { label: "חרוז חזק", cls: "strong" };
  if (result.runLength >= 2 && result.score >= 4) return { label: "חרוז בינוני", cls: "medium" };
  return { label: "חרוז רחוק", cls: "weak" };
}

function getCustomWords() {
  try {
    var raw = localStorage.getItem(LS_CUSTOM_WORDS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCustomWords(list) {
  try {
    localStorage.setItem(LS_CUSTOM_WORDS, JSON.stringify(list));
    invalidateWordsCache();
  } catch (e) {
    alert("שגיאה בשמירת המילון האישי (ייתכן ואחסון הדפדפן מלא).");
  }
}

var _allWordsCache = null;
function getAllWords() {
  if (_allWordsCache) return _allWordsCache;
  var base = window.HAROOZIM_BASE_WORDS || [];
  var extended = window.HAROOZIM_EXTENDED_WORDS || [];
  var custom = getCustomWords();
  _allWordsCache = Array.from(new Set(base.concat(extended, custom)));
  return _allWordsCache;
}

// המילון האישי משתנה בזמן ריצה (הוספה/הסרה) - צריך לבטל את המטמון כדי שישתקף מיד בחיפוש הבא
function invalidateWordsCache() {
  _allWordsCache = null;
}

function findRhymes(inputWord, minRunLength) {
  minRunLength = minRunLength || 2;
  var all = getAllWords();
  var results = [];
  all.forEach(function (candidate) {
    var r = rhymeScore(inputWord, candidate);
    // ביחידה פונטית אחת שמתאימה גם בעיצור וגם בתנועה (הברה שלמה זהה) - זה כבר משמעותי גם אם קצר
    var passesMinLength = r.runLength >= minRunLength || (r.method === "phonetic" && r.exactRun >= 1);
    if (r.score > 0 && passesMinLength) {
      var strength = rhymeStrength(r);
      results.push({ word: candidate, score: r.score, runLength: r.runLength, strength: strength });
    }
  });
  results.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.word.length - b.word.length;
  });
  return results;
}

// -------- UI --------
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

// בונה קריאת JS בטוחה להטמעה בתוך attribute מסוג onclick="..." (מרכאות כפולות)
function jsArg(s) {
  return "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
}

function el(id) { return document.getElementById(id); }

function lengthBucket(word) {
  var n = normalizeWord(word).length;
  if (n <= 2) return "vshort";
  if (n === 3) return "short";
  if (n <= 5) return "medium";
  return "long";
}

function getFavorites() {
  try {
    var raw = localStorage.getItem(LS_FAVORITES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function isFavorite(word) {
  return getFavorites().indexOf(word) !== -1;
}

function toggleFavorite(word) {
  var favs = getFavorites();
  var i = favs.indexOf(word);
  if (i === -1) favs.push(word); else favs.splice(i, 1);
  localStorage.setItem(LS_FAVORITES, JSON.stringify(favs));
  renderFavorites();
  renderResults(); // לרענן את מצב הכוכבים בתוצאות
}

function removeFavorite(word) {
  var favs = getFavorites().filter(function (w) { return w !== word; });
  localStorage.setItem(LS_FAVORITES, JSON.stringify(favs));
  renderFavorites();
  renderResults();
}

function renderFavorites() {
  var box = el("favorites-panel");
  var favs = getFavorites();
  el("fav-count").textContent = favs.length;
  if (!favs.length) {
    box.innerHTML = '<div class="empty-state small">עוד לא סימנתם חרוזים נבחרים. לחצו על ★ ליד מילה כדי להוסיף אותה לרשימה לשיר.</div>';
    return;
  }
  var html = '<div class="chip-list">';
  favs.forEach(function (w) {
    html += '<span class="chip chip-fav">' + esc(w) +
      ' <button class="chip-remove" onclick="removeFavorite(' + jsArg(w) + ')" title="הסר">×</button></span>';
  });
  html += '</div><button class="btn btn-secondary btn-small" onclick="copyFavorites()">העתק רשימה</button>';
  box.innerHTML = html;
}

function copyFavorites() {
  var favs = getFavorites();
  navigator.clipboard.writeText(favs.join(", ")).then(function () {
    alert("הרשימה הועתקה!");
  }).catch(function () {
    alert(favs.join(", "));
  });
}

function chipHtml(r, key) {
  var word = r.word;
  var fav = isFavorite(word);
  return '<span class="chip chip-' + key + (fav ? ' is-fav' : '') + '">' +
    '<button class="chip-word" onclick="searchWord(' + jsArg(word) + ')" title="חפש חרוזים ל-' + esc(word) + '">' + esc(word) + '</button>' +
    '<button class="chip-star" onclick="toggleFavorite(' + jsArg(word) + ')" title="הוסף לרשימה לשיר">' + (fav ? "★" : "☆") + '</button>' +
    '</span>';
}

function renderResults() {
  var box = el("results");
  var countHeader = el("result-count");
  var word = state.word;

  if (!word) {
    countHeader.textContent = "";
    box.innerHTML = '<div class="empty-state">הקלידו מילה למעלה כדי למצוא לה חרוזים</div>';
    return;
  }

  var filtered = state.results.filter(function (r) {
    if (!state.showWeak && r.strength.cls === "weak") return false;
    if (state.lengthFilter !== "all" && lengthBucket(r.word) !== state.lengthFilter) return false;
    return true;
  });

  if (state.results.length === 0) {
    countHeader.textContent = "";
    box.innerHTML =
      '<div class="empty-state">לא נמצאו חרוזים למילה "' + esc(word) + '" במילון.<br>' +
      'אפשר להוסיף מילים למילון האישי בהגדרות, או לנסות שיפור עם AI למטה.</div>';
    return;
  }

  countHeader.textContent = 'נמצאו ' + state.results.length + ' חרוזים למילה "' + word + '"' +
    (filtered.length !== state.results.length ? ' (מוצגים ' + filtered.length + ' לפי הסינון)' : '');

  if (filtered.length === 0) {
    box.innerHTML = '<div class="empty-state">אין תוצאות התואמות את הסינון הנוכחי. נסו לשנות את סינון האורך או להציג גם חרוזים רחוקים.</div>';
    return;
  }

  var groups = { perfect: [], strong: [], medium: [], weak: [] };
  filtered.forEach(function (r) { groups[r.strength.cls].push(r); });

  var order = [
    ["perfect", "חרוזים מושלמים"],
    ["strong", "חרוזים חזקים"],
    ["medium", "חרוזים בינוניים"],
    ["weak", "חרוזים רחוקים (סיומת בלבד)"],
  ];

  var html = "";
  order.forEach(function (pair) {
    var key = pair[0], title = pair[1];
    var list = groups[key];
    if (!list.length) return;
    var expanded = !!state.expandedGroups[key];
    var visible = expanded ? list : list.slice(0, RESULTS_PAGE_SIZE);
    var hiddenCount = list.length - visible.length;
    html += '<div class="rhyme-group rhyme-group-' + key + '">';
    html += '<h3>' + title + ' <span class="count">(' + list.length + ')</span></h3>';
    html += '<div class="chip-list">';
    visible.forEach(function (r) { html += chipHtml(r, key); });
    html += '</div>';
    if (hiddenCount > 0) {
      html += '<button class="btn btn-outline btn-small show-more-btn" onclick="expandGroup(' + jsArg(key) + ')">הצג עוד ' + hiddenCount + '</button>';
    }
    html += '</div>';
  });

  box.innerHTML = html;
}

function expandGroup(key) {
  state.expandedGroups[key] = true;
  renderResults();
}

function addToHistory(word) {
  try {
    var raw = localStorage.getItem(LS_HISTORY);
    var hist = raw ? JSON.parse(raw) : [];
    hist = hist.filter(function (w) { return w !== word; });
    hist.unshift(word);
    hist = hist.slice(0, 15);
    localStorage.setItem(LS_HISTORY, JSON.stringify(hist));
    renderHistory();
  } catch (e) { /* לא קריטי */ }
}

function renderHistory() {
  var box = el("history");
  if (!box) return;
  var raw = localStorage.getItem(LS_HISTORY);
  var hist = raw ? JSON.parse(raw) : [];
  if (!hist.length) { box.innerHTML = ""; return; }
  var html = '<span class="history-label">חיפושים אחרונים:</span>';
  hist.forEach(function (w) {
    html += '<button class="chip chip-history" onclick="searchWord(' + jsArg(w) + ')">' + esc(w) + '</button>';
  });
  box.innerHTML = html;
}

function searchWord(word) {
  el("word-input").value = word;
  doSearch();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function doSearch() {
  var raw = el("word-input").value;
  var word = normalizeWord(raw);
  el("ai-suggest-wrap").style.display = word ? "block" : "none";
  el("ai-results").innerHTML = "";
  state.word = word;
  state.results = word ? findRhymes(word) : [];
  state.expandedGroups = {};
  renderResults();
  if (word) addToHistory(word);
}

function setShowWeak(show) {
  state.showWeak = show;
  el("mode-strict").classList.toggle("active", !show);
  el("mode-loose").classList.toggle("active", show);
  renderResults();
}

function setLengthFilter(filter) {
  state.lengthFilter = filter;
  document.querySelectorAll(".length-filter-btn").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });
  renderResults();
}

// -------- מילון אישי --------
function renderCustomWordsPanel() {
  var list = getCustomWords();
  var box = el("custom-words-list");
  if (!list.length) {
    box.innerHTML = '<div class="empty-state small">עוד לא הוספתם מילים אישיות</div>';
    return;
  }
  var html = "";
  list.forEach(function (w) {
    html += '<span class="chip chip-custom">' + esc(w) +
      ' <button class="chip-remove" onclick="removeCustomWord(' + jsArg(w) + ')" title="הסר">×</button></span>';
  });
  box.innerHTML = html;
}

function addCustomWords() {
  var input = el("custom-word-input");
  var raw = input.value;
  if (!raw.trim()) return;
  var parts = raw.split(/[\s,،\n]+/).map(normalizeWord).filter(Boolean);
  if (!parts.length) {
    alert("לא זוהו מילים בעברית בטקסט שהוזן.");
    return;
  }
  var custom = getCustomWords();
  parts.forEach(function (p) {
    if (custom.indexOf(p) === -1) custom.push(p);
  });
  saveCustomWords(custom);
  input.value = "";
  renderCustomWordsPanel();
}

function removeCustomWord(word) {
  var custom = getCustomWords().filter(function (w) { return w !== word; });
  saveCustomWords(custom);
  renderCustomWordsPanel();
}

function exportCustomWords() {
  var custom = getCustomWords();
  var blob = new Blob([JSON.stringify(custom, null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "haroozim-milon-ishi.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importCustomWords(fileInput) {
  var file = fileInput.files && fileInput.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) throw new Error("bad format");
      var custom = getCustomWords();
      data.map(normalizeWord).filter(Boolean).forEach(function (w) {
        if (custom.indexOf(w) === -1) custom.push(w);
      });
      saveCustomWords(custom);
      renderCustomWordsPanel();
      alert("יובאו " + data.length + " מילים בהצלחה.");
    } catch (err) {
      alert("קובץ לא תקין. יש לייבא קובץ JSON שיוצא מ'ייצוא מילון אישי'.");
    }
  };
  reader.readAsText(file);
  fileInput.value = "";
}

// -------- הגדרות / מפתח API --------
function getAntKey() {
  return localStorage.getItem(LS_ANT_KEY) || "";
}

function saveAntKey() {
  var key = el("ant-key-input").value.trim();
  localStorage.setItem(LS_ANT_KEY, key);
  updateAiButtonVisibility();
  alert(key ? "המפתח נשמר." : "המפתח הוסר.");
}

function updateAiButtonVisibility() {
  var has = !!getAntKey();
  el("ant-key-input").value = getAntKey();
  document.querySelectorAll(".ai-only").forEach(function (elm) {
    elm.style.display = has ? "" : "none";
  });
}

function toggleSettings() {
  var panel = el("settings-panel");
  var opening = panel.style.display !== "block";
  panel.style.display = opening ? "block" : "none";
  if (opening) {
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// -------- שיפור עם AI (אופציונלי, דורש מפתח Anthropic) --------
async function aiSuggest() {
  var word = normalizeWord(el("word-input").value);
  if (!word) return;
  var key = getAntKey();
  if (!key) {
    alert("כדי להשתמש בשיפור AI יש להזין מפתח Anthropic בהגדרות.");
    toggleSettings();
    return;
  }
  var btn = el("ai-suggest-btn");
  var out = el("ai-results");
  btn.disabled = true;
  btn.textContent = "טוען הצעות...";
  out.innerHTML = "";

  var prompt =
    "אתה עוזר לכתיבת שירים בעברית ומומחה בצליל (פונטיקה) של השפה העברית. " +
    "המשתמש מחפש מילים שמתחרזות עם המילה \"" + word + "\". " +
    "חשוב מאוד: החרוז חייב להיות דומה מאוד בצליל בסוף המילה (לפחות 2-3 הברות אחרונות נשמעות כמעט זהה), לא רק אותיות דומות בכתיב. " +
    "לדוגמה: \"מכונה\" מתחרז היטב עם \"נכונה\" (סוף זהה: כונה), אבל פחות מתחרז עם \"מכורה\" (למרות שהתחלת המילה דומה, סוף המילה שונה: ונה מול ורה). " +
    "תן 15 עד 25 מילים עבריות אמיתיות (לא שמות פרטיים נדירים) שמתחרזות היטב עם \"" + word + "\", ממוינות מהחרוז הכי חזק לפחות חזק. " +
    "החזר אך ורק מערך JSON תקין של מחרוזות, בלי טקסט נוסף, לדוגמה: [\"נכונה\",\"תכונה\"]";

  try {
    var resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!resp.ok) {
      var errText = await resp.text();
      throw new Error("API error " + resp.status + ": " + errText.slice(0, 200));
    }
    var data = await resp.json();
    var text = (data.content && data.content[0] && data.content[0].text) || "[]";
    var match = text.match(/\[[\s\S]*\]/);
    var words = match ? JSON.parse(match[0]) : [];
    words = words.map(normalizeWord).filter(Boolean);

    if (!words.length) {
      out.innerHTML = '<div class="empty-state small">ה-AI לא החזיר הצעות תקינות.</div>';
    } else {
      var html = '<h3>הצעות AI</h3><div class="chip-list">';
      words.forEach(function (w) {
        html += '<button class="chip chip-ai" onclick="searchWord(' + jsArg(w) + ')">' + esc(w) + '</button>';
      });
      html += "</div>";
      out.innerHTML = html;
    }
  } catch (err) {
    out.innerHTML = '<div class="empty-state small">שגיאה בפנייה ל-AI: ' + esc(err.message) + '</div>';
  } finally {
    btn.disabled = false;
    btn.textContent = "שפר עם AI";
  }
}

// -------- עוגיות ומודעות (Google AdSense) --------
function hasCookieConsent() {
  return localStorage.getItem(LS_COOKIE_CONSENT) === "yes";
}

function initCookieBanner() {
  var banner = el("cookie-banner");
  if (!banner) return;
  if (hasCookieConsent()) {
    loadAdsense();
    loadAnalytics();
    return;
  }
  banner.style.display = "flex";
  el("cookie-accept-btn").addEventListener("click", function () {
    localStorage.setItem(LS_COOKIE_CONSENT, "yes");
    banner.style.display = "none";
    loadAdsense();
    loadAnalytics();
  });
}

// טוען את Google Analytics (GA4) - רק אחרי הסכמה לעוגיות, ורק אם הוגדר מזהה מדידה.
function loadAnalytics() {
  if (!GA_MEASUREMENT_ID || window._gaLoaded) return;
  window._gaLoaded = true;
  var script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_MEASUREMENT_ID);
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID);
}

// מפעיל את חריצי המודעות הידניים (<ins class="adsbygoogle">) - רק אחרי הסכמה לעוגיות.
// סקריפט ה-AdSense עצמו כבר נטען ב-<head> (נדרש שם ע"י גוגל לצורך אימות האתר),
// אז כאן רק דוחפים את חריצי המודעות שיש להם slot id אמיתי (ADSENSE_SLOTS).
function loadAdsense() {
  if (!ADSENSE_CLIENT) return; // עדיין לא אושרתם/הגדרתם - לא טוענים כלום

  Object.keys(ADSENSE_SLOTS).forEach(function (key) {
    var slotId = ADSENSE_SLOTS[key];
    var container = document.querySelector('.ad-slot[data-slot="' + key + '"]');
    if (!slotId || !container) return;
    container.innerHTML =
      '<ins class="adsbygoogle" style="display:block;width:100%" data-ad-client="' + esc(ADSENSE_CLIENT) +
      '" data-ad-slot="' + esc(slotId) + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  });
}

function renderAdPlaceholders() {
  if (ADSENSE_CLIENT) return; // יש כבר הגדרת AdSense אמיתית - לא מציגים placeholder
  document.querySelectorAll(".ad-slot").forEach(function (slot) {
    slot.textContent = "מקום למודעה (AdSense) - יופיע כאן לאחר אישור";
  });
}

// -------- אתחול --------
function init() {
  el("word-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") doSearch();
  });
  el("search-btn").addEventListener("click", doSearch);
  el("ai-suggest-btn").addEventListener("click", aiSuggest);
  el("settings-btn").addEventListener("click", toggleSettings);
  el("save-key-btn").addEventListener("click", saveAntKey);
  el("add-custom-word-btn").addEventListener("click", addCustomWords);
  el("custom-word-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") addCustomWords();
  });
  el("export-btn").addEventListener("click", exportCustomWords);
  el("import-input").addEventListener("change", function () { importCustomWords(this); });

  el("mode-strict").addEventListener("click", function () { setShowWeak(false); });
  el("mode-loose").addEventListener("click", function () { setShowWeak(true); });
  document.querySelectorAll(".length-filter-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { setLengthFilter(btn.dataset.filter); });
  });
  el("toggle-favorites-btn").addEventListener("click", function () {
    var panel = el("favorites-panel");
    panel.style.display = panel.style.display === "block" ? "none" : "block";
  });

  renderCustomWordsPanel();
  renderHistory();
  renderFavorites();
  updateAiButtonVisibility();
  renderResults();
  renderAdPlaceholders();
  initCookieBanner();

  var count = getAllWords().length;
  el("word-count").textContent = count.toLocaleString("he-IL");
}

document.addEventListener("DOMContentLoaded", init);
