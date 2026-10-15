/**
 * سكربت Google Apps Script — استقبال حركات حميدا وكتابتها في شيت "رصيد مع حميدا".
 *
 * طريقة التنصيب (مرة واحدة فقط):
 * 1) افتح الشيت الأساسي في المتصفح.
 * 2) من القائمة: الإضافات ← Apps Script  (Extensions ← Apps Script).
 * 3) احذف أي كود موجود في الملف الذي يفتح، وألصق هذا الملف كامله مكانه.
 * 4) غيّر قيمة SHEET_NAME أدناه إذا كان اسم التبويب مختلفًا، وغيّر SECRET إلى كلمة مرور من اختيارك.
 * 5) من زر "نشر" (Deploy) ← "نشر جديد" (New deployment) ← اختر النوع "تطبيق ويب" (Web app).
 *    - "من يستطيع الوصول" (Who has access): اختر "أي شخص" (Anyone).
 *    - اضغط نشر (Deploy)، وامنح الصلاحيات المطلوبة لحسابك عند السؤال.
 * 6) انسخ الرابط (Web app URL) الذي يظهر، وضعه في ملف index.html للتطبيق، في المتغيّر
 *    APPS_SCRIPT_URL، وضع كلمة المرور نفسها في SYNC_SECRET.
 */

var SHEET_NAME = 'رصيد مع حميدا';
var SECRET = 'GHAYYER_HETHI'; // غيّرها لكلمة مرور من اختيارك، واستخدم نفسها في التطبيق

function doPost(e) {
  var result = { ok: false };
  try {
    var body = JSON.parse(e.postData.contents);

    if (!body.secret || body.secret !== SECRET) {
      result.error = 'unauthorized';
      return respond(result);
    }

    var amount = Number(body.amount);
    var type = body.type === 'in' ? 'in' : 'out';
    var desc = String(body.desc || '').trim();
    var date = String(body.date || '').trim();

    if (!amount || amount <= 0 || !desc || !date) {
      result.error = 'invalid_data';
      return respond(result);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      result.error = 'sheet_not_found';
      return respond(result);
    }

    // ترتيب الأعمدة في الشيت: B=وارد, C=ناقص, D=البيان, E=التاريخ
    var lastRow = sheet.getLastRow();
    var newRow = lastRow + 1;
    sheet.getRange(newRow, 2, 1, 4).setValues([[
      type === 'in' ? amount : '',
      type === 'out' ? amount : '',
      desc,
      date
    ]]);

    result.ok = true;
    return respond(result);
  } catch (err) {
    result.error = String(err);
    return respond(result);
  }
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
