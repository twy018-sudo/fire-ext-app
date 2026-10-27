/**
 * Fire Safety Equipment Inspection (ถังดับเพลิง/ไฟฉุกเฉิน/ป้ายทางหนีไฟ/ตู้สายฉีด) – Google Sheets sync API
 * วิธีใช้: วางไฟล์นี้ใน Extensions > Apps Script ของ Google Sheet แล้ว Deploy เป็น Web app
 * (Execute as: Me, Who has access: Anyone)
 */
var TEAM_KEY = 'CHANGE-ME-1234';           // <-- เปลี่ยนเป็นรหัสทีมของคุณ (ห้ามเผยแพร่)
var PHOTO_FOLDER_NAME = 'FireExt Photos';  // โฟลเดอร์ใน Google Drive สำหรับเก็บรูป
// อุปกรณ์: ถังดับเพลิง (ext), ไฟฉุกเฉิน (light), ป้ายทางหนีไฟ (exit), ตู้สายฉีดน้ำดับเพลิง (hose)
// ความเข้ากันได้: category ว่าง = ถังดับเพลิง; คอลัมน์ใหม่ต่อท้ายเสมอ (ไม่สลับลำดับ) และเพิ่มหัวคอลัมน์ให้ชีตเดิมอัตโนมัติ

var CHECK_KEYS = ['gauge','pin','hose','body','access','sign','label','weight'];
var EXT_COLS = [
  ['id','รหัส / ID'],['building','อาคาร / Building'],['floor','ชั้น / Floor'],['spot','ตำแหน่ง / Location'],
  ['type','ชนิด / Type'],['size','ขนาด / Size'],['unit','หน่วย / Unit'],['install','วันติดตั้ง / Install date'],
  ['expiry','วันหมดอายุ / Expiry'],['note','หมายเหตุ / Note'],['updatedAt','แก้ไขล่าสุด / Updated (ms)'],['deleted','ลบแล้ว / Deleted'],['photoUrl','รูปถัง / Photo'],
  ['category','ประเภทอุปกรณ์ / Category (ext,light,exit,hose)']];
var CATEGORIES = ['ext', 'light', 'exit', 'hose'];
var INS_COLS = [
  ['id','รหัสการตรวจ / Inspection ID'],['extId','รหัสถัง / Extinguisher ID'],['date','วันที่ตรวจ / Date'],
  ['result','ผลรวม / Result'],['inspector','ผู้ตรวจ / Inspector'],['notes','หมายเหตุ / Notes'],
  ['gauge','เกจแรงดัน / Gauge'],['pin','สลักและซีล / Pin & seal'],['hose','สายและหัวฉีด / Hose'],
  ['body','ตัวถัง / Body'],['access','การเข้าถึง / Access'],['sign','ป้าย / Signage'],
  ['label','ฉลาก / Label'],['weight','น้ำหนัก / Weight'],['photoUrl','รูปภาพ / Photo'],['ts','เวลา / Timestamp (ms)'],
  ['category','ประเภทอุปกรณ์ / Category'],['checks','รายการตรวจ (JSON) / Checks']];

function doGet(e) { return handle_((e && e.parameter) || {}); }
function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad json' }); }
  return handle_(body);
}

function handle_(req) {
  if (String(req.key || '') !== TEAM_KEY) return out_({ ok: false, error: 'invalid key' });
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var a = req.action || 'pull', res = { ok: true };
    if (a === 'sync' || a === 'upsertExtinguishers') res.upserted = upsertExt_(req.extinguishers || []);
    if (a === 'sync' || a === 'appendInspections') res.appended = appendIns_(req.inspections || []);
    if (a === 'deleteExtinguisher') res.deleted = upsertExt_([{ id: req.id, deleted: 1, updatedAt: Number(req.updatedAt) || Date.now() }], true);
    if (a === 'sync' || a === 'pull') { res.extinguishers = readExt_(); res.inspections = readIns_(); }
    res.serverTime = Date.now();
    return out_(res);
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function sheet_(name, cols) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols.map(function (c) { return c[1]; })]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@'); // เก็บเป็นข้อความ (กันวันที่/เลข 0 นำหน้าเพี้ยน)
  } else if (sh.getLastColumn() < cols.length) { // อัปเกรด: เพิ่มหัวคอลัมน์ใหม่ต่อท้าย (ไม่แตะคอลัมน์เดิม)
    var have = sh.getLastColumn();
    if (sh.getMaxColumns && sh.getMaxColumns() < cols.length) sh.insertColumnsAfter(sh.getMaxColumns(), cols.length - sh.getMaxColumns());
    sh.getRange(1, have + 1, 1, cols.length - have).setValues([cols.slice(have).map(function (c) { return c[1]; })]).setFontWeight('bold');
    sh.getRange(1, have + 1, sh.getMaxRows(), cols.length - have).setNumberFormat('@');
  }
  return sh;
}
function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : String(v);
}
function rows_(sh, cols) {
  var n = sh.getLastRow() - 1; if (n < 1) return [];
  return sh.getRange(2, 1, n, cols.length).getValues().map(function (r) {
    var o = {}; cols.forEach(function (c, i) { o[c[0]] = cell_(r[i]); }); return o;
  });
}

function writeRow_(sh, r, row) { sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]); }

function readExt_() {
  return rows_(sheet_('Extinguishers', EXT_COLS), EXT_COLS).filter(function (o) { return o.id; }).map(function (o) {
    if (CATEGORIES.indexOf(o.category) < 0) o.category = ''; // ว่าง = ถังดับเพลิง
    o.updatedAt = Number(o.updatedAt) || 0; o.deleted = o.deleted === '1' || o.deleted === 'true' ? 1 : 0; return o;
  });
}
function upsertExt_(list, force) {
  var sh = sheet_('Extinguishers', EXT_COLS), cur = readExt_(), idx = {}, n = 0;
  cur.forEach(function (o, i) { idx[o.id] = i; });
  list.forEach(function (x) {
    if (!x || !x.id) return;
    x.updatedAt = Number(x.updatedAt) || Date.now();
    var i = idx[String(x.id)];
    if (i !== undefined && cur[i].updatedAt > x.updatedAt) return; // last write wins
    var base = i !== undefined ? cur[i] : {};
    if (force && i === undefined) return;
    var merged = (force || Number(x.deleted)) ? Object.assign({}, base, { deleted: 1, updatedAt: x.updatedAt }) : x;
    // แอปเวอร์ชันเก่าไม่ส่ง category -> คงค่าเดิมในชีตไว้
    if (merged.category === undefined || merged.category === null) merged.category = base.category || '';
    if (CATEGORIES.indexOf(String(merged.category)) < 0) merged.category = '';
    if (!merged.photoUrl && merged.photo && String(merged.photo).indexOf('data:image') === 0)
      merged.photoUrl = savePhoto_({ photo: merged.photo }, 'ext_' + merged.id + '_' + merged.updatedAt + '.jpg');
    else if (!merged.photoUrl && !merged.photoRemoved && base.photoUrl) merged.photoUrl = base.photoUrl;
    var row = EXT_COLS.map(function (c) { return c[0] === 'deleted' ? (merged.deleted ? '1' : '0') : cell_(merged[c[0]]); });
    if (i !== undefined) { writeRow_(sh, i + 2, row); cur[i] = merged; }
    else { writeRow_(sh, sh.getLastRow() + 1, row); idx[String(x.id)] = cur.length; cur.push(merged); }
    n++;
  });
  return n;
}

function readIns_() {
  return rows_(sheet_('Inspections', INS_COLS), INS_COLS).filter(function (o) { return o.id; }).map(function (o) {
    var items = {}; CHECK_KEYS.forEach(function (k) { items[k] = o[k]; delete o[k]; });
    var parsed = parseChecks_(o.checks);
    if (parsed) items = parsed; // รูปแบบใหม่: JSON ของทุกประเภท; แถวเก่าใช้คอลัมน์รายข้อเหมือนเดิม
    if (CATEGORIES.indexOf(o.category) < 0) o.category = '';
    o.items = items; o.ts = Number(o.ts) || 0; return o;
  });
}
function parseChecks_(s) {
  if (!s) return null;
  try { var o = JSON.parse(s); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch (e) { return null; }
}
function appendIns_(list) {
  var sh = sheet_('Inspections', INS_COLS), n = sh.getLastRow() - 1, have = {}, added = 0;
  var cCat = colIdx_(INS_COLS, 'category'), cChk = colIdx_(INS_COLS, 'checks');
  if (n > 0) sh.getRange(2, 1, n, INS_COLS.length).getValues().forEach(function (r, i) { have[String(r[0])] = { row: i + 2, cat: cell_(r[cCat]), chk: cell_(r[cChk]) }; });
  list.forEach(function (x) {
    if (!x || !x.id) return;
    var h = have[String(x.id)];
    if (h) { // idempotent; แต่เติม category/checks ที่หายไป (ส่งตอนสคริปต์ยังเป็นเวอร์ชันเก่า)
      if (x.items && typeof x.items === 'object' && (!h.chk || (!h.cat && x.category))) {
        sh.getRange(h.row, cCat + 1, 1, 2).setNumberFormat('@').setValues([[cell_(catOf_(x.category)), JSON.stringify(x.items)]]);
        h.cat = catOf_(x.category); h.chk = '1';
      }
      return;
    }
    var photoUrl = x.photoUrl || '';
    if (!photoUrl && x.photo && String(x.photo).indexOf('data:image') === 0) photoUrl = savePhoto_(x);
    var o = Object.assign({}, x, x.items || {}, { photoUrl: photoUrl, category: catOf_(x.category),
      checks: x.items && typeof x.items === 'object' ? JSON.stringify(x.items) : '' });
    writeRow_(sh, sh.getLastRow() + 1, INS_COLS.map(function (c) { return cell_(o[c[0]]); }));
    have[String(x.id)] = { row: sh.getLastRow(), cat: o.category, chk: o.checks }; added++;
  });
  return added;
}
function colIdx_(cols, key) { for (var i = 0; i < cols.length; i++) if (cols[i][0] === key) return i; return -1; }
function catOf_(c) { return CATEGORIES.indexOf(String(c || '')) >= 0 ? String(c) : ''; }
function savePhoto_(x, name) {
  try {
    var it = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
    var folder = it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
    var m = String(x.photo).match(/^data:(image\/\w+);base64,(.*)$/);
    if (!m) return '';
    var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name || (x.extId + '_' + x.date + '_' + x.id + '.jpg'));
    var f = folder.createFile(blob);
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {} // อาจถูกจำกัดในบัญชีองค์กร
    return f.getUrl();
  } catch (err) { return 'ERROR: ' + err; }
}

/** รันฟังก์ชันนี้หนึ่งครั้งใน Editor เพื่ออนุญาตสิทธิ์และสร้างชีต */
function setup() { sheet_('Extinguishers', EXT_COLS); sheet_('Inspections', INS_COLS); DriveApp.getRootFolder(); }
