/**
 * Fire Extinguisher Inspection – Google Sheets sync API
 * วิธีใช้: วางไฟล์นี้ใน Extensions > Apps Script ของ Google Sheet แล้ว Deploy เป็น Web app
 * (Execute as: Me, Who has access: Anyone)
 */
var TEAM_KEY = 'CHANGE-ME-1234';           // <-- เปลี่ยนเป็นรหัสทีมของคุณ (ห้ามเผยแพร่)
var PHOTO_FOLDER_NAME = 'FireExt Photos';  // โฟลเดอร์ใน Google Drive สำหรับเก็บรูป

var CHECK_KEYS = ['gauge','pin','hose','body','access','sign','label','weight'];
var EXT_COLS = [
  ['id','รหัส / ID'],['building','อาคาร / Building'],['floor','ชั้น / Floor'],['spot','ตำแหน่ง / Location'],
  ['type','ชนิด / Type'],['size','ขนาด / Size'],['unit','หน่วย / Unit'],['install','วันติดตั้ง / Install date'],
  ['expiry','วันหมดอายุ / Expiry'],['note','หมายเหตุ / Note'],['updatedAt','แก้ไขล่าสุด / Updated (ms)'],['deleted','ลบแล้ว / Deleted'],['photoUrl','รูปถัง / Photo']];
var INS_COLS = [
  ['id','รหัสการตรวจ / Inspection ID'],['extId','รหัสถัง / Extinguisher ID'],['date','วันที่ตรวจ / Date'],
  ['result','ผลรวม / Result'],['inspector','ผู้ตรวจ / Inspector'],['notes','หมายเหตุ / Notes'],
  ['gauge','เกจแรงดัน / Gauge'],['pin','สลักและซีล / Pin & seal'],['hose','สายและหัวฉีด / Hose'],
  ['body','ตัวถัง / Body'],['access','การเข้าถึง / Access'],['sign','ป้าย / Signage'],
  ['label','ฉลาก / Label'],['weight','น้ำหนัก / Weight'],['photoUrl','รูปภาพ / Photo'],['ts','เวลา / Timestamp (ms)']];

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
  } else if (sh.getLastColumn() < cols.length) { // อัปเกรด: เพิ่มหัวคอลัมน์ใหม่
    sh.getRange(1, 1, 1, cols.length).setValues([cols.map(function (c) { return c[1]; })]).setFontWeight('bold');
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
    o.items = items; o.ts = Number(o.ts) || 0; return o;
  });
}
function appendIns_(list) {
  var sh = sheet_('Inspections', INS_COLS), n = sh.getLastRow() - 1, have = {}, added = 0;
  if (n > 0) sh.getRange(2, 1, n, 1).getValues().forEach(function (r) { have[String(r[0])] = 1; });
  list.forEach(function (x) {
    if (!x || !x.id || have[String(x.id)]) return; // idempotent
    var photoUrl = x.photoUrl || '';
    if (!photoUrl && x.photo && String(x.photo).indexOf('data:image') === 0) photoUrl = savePhoto_(x);
    var o = Object.assign({}, x, x.items || {}, { photoUrl: photoUrl });
    writeRow_(sh, sh.getLastRow() + 1, INS_COLS.map(function (c) { return cell_(o[c[0]]); }));
    have[String(x.id)] = 1; added++;
  });
  return added;
}
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
