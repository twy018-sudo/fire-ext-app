'use strict';
const KEY_T='fe_tombstones',KEY_E='fe_extinguishers',KEY_I='fe_inspections',KEY_S='fe_settings';
const TYPES=['CO2 (คาร์บอนไดออกไซด์)','ผงเคมีแห้ง (Dry Chemical)','โฟม (Foam)','น้ำ (Water)','สารสะอาด (Clean Agent / Halotron)','Fireaid 2000','อื่นๆ'];
const CHECKS=[['gauge','เข็มเกจวัดแรงดันอยู่ในโซนสีเขียว'],['pin','สลักนิรภัยและซีลอยู่ในสภาพสมบูรณ์'],['hose','สายฉีดและหัวฉีดอยู่ในสภาพดี ไม่แตก/อุดตัน'],['body','ตัวถังไม่มีสนิม ไม่บุบ ไม่เสียหาย'],['access','ติดตั้งในที่เข้าถึงง่าย ไม่มีสิ่งกีดขวาง'],['sign','ป้ายสัญลักษณ์มองเห็นชัดเจน'],['label','ฉลาก/คำแนะนำการใช้อ่านได้ชัดเจน'],['weight','น้ำหนักถังปกติ (ยกแล้วไม่เบาผิดปกติ)']];
const CATS={
 ext:{name:'ถังดับเพลิง',icon:'🧯',prefix:'FE-',checks:CHECKS},
 light:{name:'ไฟฉุกเฉิน',icon:'💡',prefix:'EL-',checks:[['l_test','กดปุ่มทดสอบแล้วไฟติด'],['l_batt','แบตเตอรี่สำรองใช้งานได้ (ติดนานพอ)'],['l_led','ไฟแสดงสถานะ (LED ชาร์จ) ปกติ'],['l_lamp','หลอด/โคมไม่แตกเสียหาย'],['l_mount','ติดตั้งแน่นหนา ไม่มีสิ่งกีดขวาง']]},
 exit:{name:'ป้ายทางหนีไฟ',icon:'🚪',prefix:'EX-',checks:[['x_lit','ป้ายมีไฟส่องสว่าง'],['x_vis','มองเห็นชัดเจน ไม่มีสิ่งบัง'],['x_arrow','ทิศทางลูกศรถูกต้อง'],['x_batt','ไฟสำรองทำงานเมื่อกดทดสอบ'],['x_mount','ติดตั้งแน่นหนา ไม่ชำรุด']]},
 hose:{name:'ตู้สายฉีดน้ำดับเพลิง',icon:'🚒',prefix:'FH-',checks:[['h_access','ตู้ไม่มีสิ่งกีดขวาง เปิดได้สะดวก'],['h_hose','สายฉีดอยู่ในสภาพดี ไม่รั่ว/ไม่แตก'],['h_nozzle','หัวฉีดครบและใช้งานได้'],['h_valve','วาล์วเปิด-ปิดได้ไม่รั่วซึม'],['h_glass','ป้ายและกระจกตู้อยู่ในสภาพดี']]}};
const CAT_KEYS=Object.keys(CATS);
const catOf=e=>e&&CATS[e.category]?e.category:'ext'; // ว่าง/ไม่มี = ถังดับเพลิง (ข้อมูลเดิม)
const catLabel=c=>CATS[c].icon+' '+CATS[c].name;
const catChecks=c=>CATS[c].checks;
function insCat(i){if(CATS[i.category])return i.category;const ks=Object.keys(i.items||{});const f=CAT_KEYS.find(c=>catChecks(c).some(([k])=>ks.includes(k)));if(f)return f;return catOf(findE(i.extId))}
const INTERVAL=30,SOON=7,EXP_SOON=60;
const $=s=>document.querySelector(s),app=$('#app');
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){alert('บันทึกไม่สำเร็จ: พื้นที่เก็บข้อมูลเต็ม (ลองลบรูปภาพเก่าหรือสำรองข้อมูล)');return false}};
let E=load(KEY_E,[]),I=load(KEY_I,[]),S=load(KEY_S,{inspector:''}),T=load(KEY_T,[]);
I.forEach(i=>{if(!i.id)i.id=String(i.ts)});E.forEach(e=>{if(!e.updatedAt){e.updatedAt=1;e.dirty=1}});
const newId=()=>'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const days=(a,b)=>Math.round((new Date(a)-new Date(b))/864e5);
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
const thDate=d=>d?new Date(d).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'}):'-';
const loc=e=>[e.building&&'อาคาร '+e.building,e.floor&&'ชั้น '+e.floor,e.spot].filter(Boolean).join(' / ');
const findE=id=>E.find(e=>e.id===id);
const insOf=id=>I.filter(i=>i.extId===id).sort((a,b)=>b.date.localeCompare(a.date)||b.ts-a.ts);
function status(e){const last=insOf(e.id)[0],r={last};
 r.due=last?addDays(last.date,INTERVAL):null;const dd=r.due?days(r.due,today()):-1;
 r.insp=!last?'never':dd<0?'overdue':dd<=SOON?'soon':'ok';r.dueIn=dd;
 if(e.expiry&&catOf(e)==='ext'){const x=days(e.expiry,today());r.exp=x<0?'expired':x<=EXP_SOON?'soon':'ok';r.expIn=x}else r.exp='none';return r}
const inspBadge=s=>({never:'<span class="badge red">ยังไม่เคยตรวจ</span>',overdue:'<span class="badge red">เลยกำหนดตรวจ</span>',soon:'<span class="badge orange">ใกล้ถึงกำหนดตรวจ</span>',ok:'<span class="badge green">ตรวจแล้ว</span>'}[s]);
const expBadge=s=>({expired:'<span class="badge red">หมดอายุ</span>',soon:'<span class="badge orange">ใกล้หมดอายุ</span>'}[s]||'');
function setTitle(t,back){$('#title').textContent=t;$('#back').style.visibility=back?'visible':'hidden'}
$('#back').onclick=()=>history.length>1?history.back():location.hash='#/';
let scanner=null;async function stopScan(){if(scanner){try{await scanner.stop()}catch{}try{scanner.clear()}catch{}scanner=null}}
function extUrl(id){return location.origin+location.pathname+'#id='+encodeURIComponent(id)}
function parseScan(t){const m=t.match(/[#&?]id=([^&]+)/);return m?decodeURIComponent(m[1]):t.trim()}

async function route(){await stopScan();let h=location.hash||'#/';
 if(h.startsWith('#setup=')){acceptSetup(h.slice(7));return}
 if(h.startsWith('#id=')){location.replace('#/inspect/'+h.slice(4));return}
 const [,p,a]=h.split('/').map(decodeURIComponent);
 document.querySelectorAll('.bottom a').forEach(x=>x.classList.toggle('on',x.getAttribute('href')==='#/'+(p||'')));
 window.scrollTo(0,0);
 ({'':dash,list:()=>list(a),new:()=>edit(null,a),edit:()=>edit(a),ext:()=>detail(a),inspect:()=>inspect(a),scan,qr:()=>qr(a),data,view:()=>viewIns(a)}[p]||dash)();}
addEventListener('hashchange',route);

const extInfo=e=>catOf(e)==='ext'?`${esc(e.type||'')} ${e.size?esc(e.size)+' '+esc(e.unit):''}`:'';
function card(e){const s=status(e),c=catOf(e);return `<a class="item card cat-${c}" href="#/ext/${encodeURIComponent(e.id)}">${photoHtml(e,1)}<div class="row"><b>${CATS[c].icon} ${esc(e.id)}</b><span>${inspBadge(s.insp)} ${expBadge(s.exp)}</span></div>
<div class="small">${esc(CATS[c].name)} · ${esc(loc(e))||'-'}</div>${c==='ext'?`<div class="small">${extInfo(e)}</div>`:''}
<div class="small">ตรวจล่าสุด: ${s.last?thDate(s.last.date)+(s.last.result==='pass'?' ✅':' ❌'):'-'} · ครบกำหนด: ${s.due?thDate(s.due):'ทันที'}${e.expiry?' · หมดอายุ: '+thDate(e.expiry):''}</div></a>`}

function catStats(arr,month){const st=arr.map(e=>status(e)),ids=new Set(arr.map(e=>e.id));
 return {total:arr.length,done:new Set(I.filter(i=>i.date.startsWith(month)&&ids.has(i.extId)).map(i=>i.extId)).size,failed:st.filter(s=>s.last&&s.last.result==='fail').length,over:st.filter(s=>s.insp==='overdue'||s.insp==='never').length}}
function dash(){setTitle('แดชบอร์ด');const EE=EA(),on=ON(),st=EE.map(e=>[e,status(e)]),hid=CAT_KEYS.filter(c=>!catOn(c));
 const over=st.filter(([,s])=>s.insp==='overdue'||s.insp==='never'),soon=st.filter(([,s])=>s.insp==='soon'),exp=st.filter(([,s])=>s.exp==='expired'||s.exp==='soon');
 const month=today().slice(0,7),done=new Set(I.filter(i=>{const e=findE(i.extId);return i.date.startsWith(month)&&e&&catOn(catOf(e))}).map(i=>i.extId)).size,failed=st.filter(([,s])=>s.last&&s.last.result==='fail');
 app.innerHTML=`<img class="banner" src="img/banner.jpg" alt="Nana Plaza, Sukhumvit Soi 4, Bangkok">
<div class="catgrid n${on.length}">${on.map(c=>{const k=catStats(E.filter(e=>catOf(e)===c),month);return `<a class="catbtn cat-${c}" data-c="${c}" href="#/list/${c}"><span class="ci">${CATS[c].icon}</span><span class="cn">${CATS[c].name}</span>
<span class="cc"><span data-k="total"><small>ทั้งหมด</small><b>${k.total}</b></span><span data-k="done"><small>ตรวจเดือนนี้</small><b class="green">${k.done}</b></span><span data-k="failed" class="${k.failed?'hot':''}"><small>ไม่ผ่าน</small><b>${k.failed}</b></span><span data-k="over" class="${k.over?'hot':''}"><small>เลยกำหนด</small><b>${k.over}</b></span></span></a>`}).join('')}</div>
<a class="btn full scanbtn" href="#/scan" aria-label="สแกน QR เพื่อตรวจอุปกรณ์"><span class="s1"><span class="si" aria-hidden="true">📷</span>สแกน QR</span><span class="s2">เพื่อตรวจอุปกรณ์</span></a>
<div class="stats mini"><div class="stat" data-k="total"><small>อุปกรณ์<br>ทั้งหมด</small><b>${EE.length}</b></div><div class="stat" data-k="done"><small>ตรวจแล้ว<br>เดือนนี้</small><b class="green">${done}</b></div><div class="stat" data-k="over"><small>เลยกำหนด/<br>ยังไม่ตรวจ</small><b class="red">${over.length}</b></div><div class="stat" data-k="exp"><small>หมดอายุ/<br>ใกล้หมด</small><b class="orange">${exp.length}</b></div></div>
${hid.length?`<p class="small gray hidnote">ซ่อนอยู่: ${hid.map(catLabel).join(', ')} · เปิดได้ที่ 💾 ข้อมูล → ประเภทอุปกรณ์ที่ตรวจ</p>`:''}
${E.length?'':`<div class="card">ยังไม่มีข้อมูลอุปกรณ์ <a href="#/new">+ เพิ่มอุปกรณ์แรก</a> หรือ <a href="#" id="demo">โหลดข้อมูลตัวอย่าง</a></div>`}
${sec('❌ ผลตรวจล่าสุดไม่ผ่าน',failed)}${sec('🔴 เลยกำหนดตรวจ / ยังไม่เคยตรวจ',over)}${sec('🟠 ใกล้ถึงกำหนดตรวจ (ภายใน '+SOON+' วัน)',soon)}${sec('⏳ หมดอายุ / ใกล้หมดอายุ (ภายใน '+EXP_SOON+' วัน)',exp)}`;
 const d=$('#demo');if(d)d.onclick=ev=>{ev.preventDefault();demo();route()};
 function sec(t,arr){return arr.length?`<h3>${t} (${arr.length})</h3>`+arr.map(([e])=>card(e)).join(''):''}}

function catChips(cur,href){const on=ON();return `<div class="chips">${['',...on].map(c=>`<a class="chip ${c===(cur||'')?'on':''}" data-c="${c}" href="${href(c)}">${c?catLabel(c):'ทั้งหมด'} (${c?E.filter(e=>catOf(e)===c).length:EA().length})</a>`).join('')}</div>`}
function list(cat){if(!CATS[cat]||!catOn(cat))cat='';setTitle(cat?'รายการ'+CATS[cat].name:'รายการอุปกรณ์');app.innerHTML=`${catChips(cat,c=>'#/list'+(c?'/'+c:''))}<a class="btn full" href="#/new${cat?'/'+CATS[cat].prefix:''}">+ เพิ่ม${cat?CATS[cat].name:'อุปกรณ์'}</a><input id="q" placeholder="ค้นหา รหัส / อาคาร / ชั้น / จุด"><div id="ls" style="margin-top:10px"></div>`;
 const r=()=>{const q=$('#q').value.toLowerCase();const f=EA().filter(e=>(!cat||catOf(e)===cat)&&(e.id+' '+loc(e)+' '+(e.type||'')+' '+CATS[catOf(e)].name).toLowerCase().includes(q)).sort((a,b)=>a.id.localeCompare(b.id,'th',{numeric:true}));
  $('#ls').innerHTML=f.map(card).join('')||'<p class="gray">ไม่พบข้อมูล</p>'};$('#q').oninput=r;r()}

const guessCat=id=>CAT_KEYS.find(c=>String(id||'').toUpperCase().startsWith(CATS[c].prefix))||'';
function edit(id,newId0){const e=id?findE(id):null;if(id&&!e)return notFound(id);const nid=e?'':String(newId0||'').trim();const v=e||{unit:'lbs',install:today(),id:nid,category:guessCat(nid)||'ext'};let cat=catOf(v);if(!e&&!catOn(cat))cat=ON()[0];const pick=CAT_KEYS.filter(c=>catOn(c)||c===cat);
 setTitle(e?'แก้ไข '+e.id:'เพิ่มอุปกรณ์',1);
 app.innerHTML=`<form class="card" id="f"><label>ประเภทอุปกรณ์ *</label><div class="catpick n${pick.length}">${pick.map(c=>`<label class="catopt"><input type="radio" name="category" value="${c}" ${c===cat?'checked':''}><span><span class="oi">${CATS[c].icon}</span>${CATS[c].name}</span></label>`).join('')}</div>
<label>รหัสอุปกรณ์ (ID) *</label><input name="id" required value="${esc(v.id)}" ${e?'readonly':''} placeholder="เช่น ${CATS[cat].prefix}A-01-001">
<label>อาคาร</label><input name="building" value="${esc(v.building)}"><label>ชั้น</label><input name="floor" value="${esc(v.floor)}">
<label>ตำแหน่ง/จุดติดตั้ง</label><input name="spot" value="${esc(v.spot)}" placeholder="เช่น หน้าลิฟต์โดยสาร">
<div class="extonly"><label>ชนิดสารดับเพลิง</label><select name="type">${TYPES.map(t=>`<option ${t===v.type?'selected':''}>${t}</option>`).join('')}</select>
<label>ขนาด</label><div class="row"><input name="size" type="number" step="0.1" min="0" value="${esc(v.size)}"><select name="unit" style="width:100px"><option ${v.unit==='lbs'?'selected':''}>lbs</option><option ${v.unit==='kg'?'selected':''}>kg</option></select></div>
<label>วันหมดอายุ / ครบกำหนดเติมสาร</label><input name="expiry" type="date" value="${esc(v.expiry)}"></div>
<label>วันที่ติดตั้ง</label><input name="install" type="date" value="${esc(v.install)}">
<label>หมายเหตุ</label><textarea name="note" rows="2">${esc(v.note)}</textarea>
<label>รูปอุปกรณ์ (ไม่บังคับ)</label><input type="file" id="eph" accept="image/*" capture="environment"><div id="epv">${photoHtml(v)}</div>${v.photo||v.photoUrl?'<button type="button" class="btn sec" id="erm">ลบรูป</button>':''}
<button class="btn ok full">💾 บันทึก</button>${e?'<button type="button" id="del" class="btn full">🗑 ลบอุปกรณ์นี้</button>':''}</form>`;
 const idIn=$('[name=id]'),setCat=c=>{const old=CATS[cat].prefix;cat=c;document.querySelectorAll('.extonly').forEach(x=>x.hidden=c!=='ext');idIn.placeholder='เช่น '+CATS[c].prefix+'A-01-001';
  if(!e){const cur=idIn.value.trim();if(!cur||cur.toUpperCase()===old.toUpperCase()||CAT_KEYS.some(k=>cur.toUpperCase()===CATS[k].prefix))idIn.value=CATS[c].prefix;else if(cur.toUpperCase().startsWith(old.toUpperCase())&&guessCat(cur)!==c)idIn.value=CATS[c].prefix+cur.slice(old.length)}};
 document.querySelectorAll('[name=category]').forEach(r=>r.onchange=()=>setCat(r.value));setCat(cat);
 let newPhoto;$('#eph').onchange=async ev=>{const f=ev.target.files[0];if(!f)return;newPhoto=await shrink(f,640);$('#epv').innerHTML=`<img class="photo" src="${newPhoto}">`};
 if($('#erm'))$('#erm').onclick=()=>{newPhoto='';$('#epv').innerHTML='<p class="small">จะลบรูปเมื่อกดบันทึก</p>'};
 $('#f').onsubmit=ev=>{ev.preventDefault();const o=Object.fromEntries(new FormData(ev.target));o.id=o.id.trim();o.category=CATS[o.category]?o.category:'ext';
  if(o.category!=='ext'){o.type='';o.size='';o.unit='';o.expiry=''}delete o.catPending;
  if(!o.id||CAT_KEYS.some(k=>o.id.toUpperCase()===CATS[k].prefix))return alert('กรุณากรอกรหัสอุปกรณ์ให้ครบ');
  if(!e&&findE(o.id))return alert('รหัสนี้มีอยู่แล้ว');if(e)delete e.catPending;if(newPhoto!==undefined){o.photo=newPhoto;o.photoUrl='';o.photoRemoved=newPhoto?0:1}o.updatedAt=Date.now();o.dirty=1;if(e)Object.assign(e,o);else E.push(o);T=T.filter(t=>t.id!==o.id);save(KEY_E,E);save(KEY_T,T);scheduleSync();location.replace('#/ext/'+encodeURIComponent(o.id))};
 if(e)$('#del').onclick=()=>{if(confirm('ลบ '+e.id+'? (จะลบในทีมด้วยเมื่อซิงก์)')){E=E.filter(x=>x!==e);T=T.filter(t=>t.id!==e.id);T.push({id:e.id,updatedAt:Date.now(),dirty:1});save(KEY_E,E);save(KEY_T,T);scheduleSync();location.replace('#/list')}}}

function notFound(id){setTitle('ไม่พบข้อมูล',1);app.innerHTML=`<div class="card">ไม่พบอุปกรณ์รหัส <b>${esc(id)}</b> ในเครื่องนี้ (ลองซิงก์ข้อมูลทีมก่อน)<br><a class="btn" href="#/new/${encodeURIComponent(id)}">+ เพิ่มอุปกรณ์รหัสนี้</a></div>`;
 setTimeout(()=>{const i=document.querySelector('[name=id]')},0)}

function detail(id){const e=findE(id);if(!e)return notFound(id);const c=catOf(e);setTitle(CATS[c].name+' '+e.id,1);const s=status(e),h=insOf(id);
 app.innerHTML=`${offNote(c)}<div class="card"><div class="row"><b style="font-size:20px">${esc(e.id)}</b><span>${inspBadge(s.insp)} ${expBadge(s.exp)}</span></div>
<p>${catLabel(c)}<br>📍 ${esc(loc(e))||'-'}${c==='ext'?'<br>🧯 '+extInfo(e):''}<br>ติดตั้ง: ${thDate(e.install)}${c==='ext'?'<br>หมดอายุ/เติมสาร: '+thDate(e.expiry):''}<br>ครบกำหนดตรวจ: ${s.due?thDate(s.due):'ทันที'}${e.note?'<br>หมายเหตุ: '+esc(e.note):''}</p>${photoHtml(e)}
<div id="qr" style="display:flex;justify-content:center"></div>
<a class="btn ok" href="#/inspect/${encodeURIComponent(id)}">✅ ตรวจประจำเดือน</a><a class="btn sec" href="#/edit/${encodeURIComponent(id)}">✏️ แก้ไข</a><a class="btn sec" href="#/qr/${encodeURIComponent(id)}">🖨 พิมพ์ QR</a></div>
<h3>ประวัติการตรวจ (${h.length})</h3>${h.map(i=>`<a class="item card" href="#/view/${i.ts}"><div class="row"><b>${thDate(i.date)}</b>${i.result==='pass'?'<span class="badge green">ผ่าน</span>':'<span class="badge red">ไม่ผ่าน</span>'}</div><div class="small">ผู้ตรวจ: ${esc(i.inspector)}${i.notes?' · '+esc(i.notes):''}${i.photo||i.photoUrl?' · 📷':''}${i.synced?'':' · ⏳'}</div></a>`).join('')||'<p class="gray">ยังไม่มีประวัติ</p>'}`;
 bindReon(c);new QRCode($('#qr'),{text:extUrl(id),width:160,height:160,correctLevel:QRCode.CorrectLevel.M})}

function viewIns(ts){const i=I.find(x=>String(x.ts)===ts);if(!i)return notFound(ts);const e=findE(i.extId);setTitle('ผลตรวจ '+i.extId,1);
 app.innerHTML=`<div class="card"><b>${esc(i.extId)}</b> · ${thDate(i.date)}<div class="small">${esc(e?loc(e):'')}</div>
<div class="overall ${i.result}">${i.result==='pass'?'✅ ผ่าน':'❌ ไม่ผ่าน'}</div>
<div class="small">${catLabel(insCat(i))}</div>${catChecks(insCat(i)).map(([k,t])=>`<div class="chk"><span>${t}</span><b class="${i.items[k]==='pass'?'green':'red'}">${i.items[k]==='pass'?'ผ่าน':'ไม่ผ่าน'}</b></div>`).join('')}
<p>ผู้ตรวจ: ${esc(i.inspector)}<br>หมายเหตุ: ${esc(i.notes)||'-'}</p>${i.photo?`<img class="photo" src="${i.photo}">`:i.photoUrl&&/^https:/.test(i.photoUrl)?`<a class="btn sec" target="_blank" rel="noopener" href="${esc(i.photoUrl)}">📷 ดูรูปใน Google Drive</a>`:''}<p class="small">${i.synced?'☁️ ซิงก์แล้ว':'⏳ ยังไม่ซิงก์'}</p>
${i.synced?'':'<button class="btn" id="d">🗑 ลบรายการตรวจนี้</button>'}</div>`;
 if($('#d'))$('#d').onclick=()=>{if(confirm('ลบรายการตรวจนี้?')){I=I.filter(x=>x!==i);save(KEY_I,I);history.back()}}}

function inspect(id){const e=findE(id);if(!e)return notFound(id);const cat=catOf(e),CHECKS=catChecks(cat);setTitle('ตรวจ'+CATS[cat].name+' '+e.id,1);const items={};let photo='';
 app.innerHTML=`${offNote(cat)}<div class="card"><b style="font-size:18px">${CATS[cat].icon} ${esc(e.id)}</b><div class="small">${esc(CATS[cat].name)} · 📍 ${esc(loc(e))}${cat==='ext'?' · '+extInfo(e):''}</div>
<div class="small">วันที่ตรวจ: ${thDate(today())}</div>${expBadge(status(e).exp)}</div>
<div class="card"><div class="row"><b>รายการตรวจประจำเดือน (${esc(CATS[cat].name)})</b><button class="btn sec" id="all" style="padding:6px 10px;font-size:13px">ผ่านทั้งหมด</button></div>
${CHECKS.map(([k,t],n)=>`<div class="chk"><span>${n+1}. ${t}</span><div class="pf" data-k="${k}"><button class="p">ผ่าน</button><button class="f">ไม่ผ่าน</button></div></div>`).join('')}
<div id="ov" class="overall">กรุณาตรวจให้ครบทุกข้อ</div>
<label>หมายเหตุ</label><textarea id="notes" rows="3" placeholder="รายละเอียดข้อบกพร่อง / การแก้ไข"></textarea>
<label>ชื่อผู้ตรวจ *</label><input id="insp" value="${esc(S.inspector)}">
<label>รูปถ่าย (ไม่บังคับ)</label><input type="file" id="ph" accept="image/*" capture="environment"><img id="pv" class="photo" hidden>
<button class="btn ok full" id="sv" style="margin-top:12px">💾 บันทึกผลการตรวจ</button></div>`;
 const upd=()=>{document.querySelectorAll('.pf').forEach(d=>{d.querySelector('.p').classList.toggle('on',items[d.dataset.k]==='pass');d.querySelector('.f').classList.toggle('on',items[d.dataset.k]==='fail')});
  const n=Object.keys(items).length,ov=$('#ov');if(n<CHECKS.length){ov.className='overall';ov.textContent=`ตรวจแล้ว ${n}/${CHECKS.length} ข้อ`}else{const p=Object.values(items).every(x=>x==='pass');ov.className='overall '+(p?'pass':'fail');ov.textContent='ผลรวม: '+(p?'✅ ผ่าน':'❌ ไม่ผ่าน')}};
 document.querySelectorAll('.pf').forEach(d=>d.onclick=ev=>{if(ev.target.tagName!=='BUTTON')return;items[d.dataset.k]=ev.target.classList.contains('p')?'pass':'fail';upd()});
 $('#all').onclick=()=>{CHECKS.forEach(([k])=>items[k]='pass');upd()};
 $('#ph').onchange=async ev=>{const f=ev.target.files[0];if(!f)return;photo=await shrink(f);$('#pv').src=photo;$('#pv').hidden=false};
 $('#sv').onclick=()=>{if(Object.keys(items).length<CHECKS.length)return alert('กรุณาตรวจให้ครบทุกข้อ');const ins=$('#insp').value.trim();if(!ins)return alert('กรุณากรอกชื่อผู้ตรวจ');
  S.inspector=ins;save(KEY_S,S);const rec={id:newId(),ts:Date.now(),synced:false,extId:id,category:cat,date:today(),items:{...items},result:Object.values(items).every(x=>x==='pass')?'pass':'fail',notes:$('#notes').value.trim(),inspector:ins,photo};
  I.push(rec);if(!save(KEY_I,I)){I.pop();return}scheduleSync();alert('บันทึกแล้ว: '+(rec.result==='pass'?'ผ่าน':'ไม่ผ่าน'));location.replace('#/ext/'+encodeURIComponent(id))}}
function driveThumb(u){const m=String(u||'').match(/\/d\/([\w-]+)/)||String(u||'').match(/[?&]id=([\w-]+)/);return m?'https://drive.google.com/thumbnail?id='+m[1]+'&sz=w600':''}
function photoHtml(e,thumb){const cls=thumb?'thumb':'photo';if(e.photo)return `<img class="${cls}" src="${e.photo}" alt="">`;
 if(e.photoUrl&&/^https:/.test(e.photoUrl)){const t=driveThumb(e.photoUrl);if(thumb)return t?`<img class="thumb" src="${esc(t)}" alt="" loading="lazy" onerror="this.remove()">`:'';
  return `${t?`<img class="photo" src="${esc(t)}" alt="" onerror="this.remove()">`:''}<a class="small" target="_blank" rel="noopener" href="${esc(e.photoUrl)}">📷 เปิดรูปใน Google Drive</a>`}return ''}
function shrink(f,max=800){return new Promise(res=>{const img=new Image();img.onload=()=>{const m=max,k=Math.min(1,m/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=img.width*k;c.height=img.height*k;c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);res(c.toDataURL('image/jpeg',0.6))};img.src=URL.createObjectURL(f)})}

function scan(){setTitle('สแกน QR');app.innerHTML=`<div class="card"><div id="reader"></div><p class="small" id="msg">กำลังเปิดกล้อง... (ต้องอนุญาตการใช้กล้อง)</p>
<label>หรือพิมพ์รหัสอุปกรณ์</label><div class="row"><input id="mid" list="ids"><button class="btn" id="go">ไป</button></div><datalist id="ids">${EA().map(e=>`<option value="${esc(e.id)}">`).join('')}</datalist></div>`;
 $('#go').onclick=()=>{const v=$('#mid').value.trim();if(v)location.hash='#/inspect/'+encodeURIComponent(v)};
 if(typeof Html5Qrcode==='undefined'){$('#msg').textContent='ไม่พบไลบรารีสแกน';return}
 scanner=new Html5Qrcode('reader');scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:230,height:230}},t=>{const id=parseScan(t);stopScan().then(()=>{navigator.vibrate&&navigator.vibrate(150);location.hash='#/inspect/'+encodeURIComponent(id)})},()=>{})
  .then(()=>$('#msg').textContent='เล็งกล้องไปที่ QR บนอุปกรณ์ (ถังดับเพลิง / ไฟฉุกเฉิน / ป้ายทางหนีไฟ / ตู้สายฉีด)').catch(err=>{$('#msg').textContent='เปิดกล้องไม่ได้: '+err+' (ต้องใช้ HTTPS หรือ localhost)';scanner=null})}

function qr(one){setTitle('ป้าย QR',1);if(one&&!findE(one))one='';const sel=(one?E:EA()).filter(e=>!one||e.id===one).sort((a,b)=>a.id.localeCompare(b.id,'th',{numeric:true}));
 const bs=[...new Set(EA().map(e=>e.building).filter(Boolean))];
 app.innerHTML=`<div class="card no-print"><p class="small">พิมพ์บนกระดาษ A4 (4 คอลัมน์ต่อแถว) ตัดตามเส้นประแล้วติดที่อุปกรณ์ · QR เก็บลิงก์ <code>${esc(extUrl('รหัส'))}</code></p>
${one?'':`<label>ประเภทอุปกรณ์</label><select id="fc"><option value="">ทั้งหมด</option>${ON().map(c=>`<option value="${c}">${catLabel(c)} (${E.filter(e=>catOf(e)===c).length})</option>`).join('')}</select><label>กรองตามอาคาร</label><select id="fb"><option value="">ทั้งหมด</option>${bs.map(b=>`<option>${esc(b)}</option>`).join('')}</select>`}
<button class="btn" onclick="print()">🖨 พิมพ์</button></div><div class="qrsheet" id="sheet"></div>`;
 const r=(b,c)=>{const sh=$('#sheet');sh.innerHTML='';sel.filter(e=>(!b||e.building===b)&&(!c||catOf(e)===c)).forEach(e=>{const k=catOf(e),d=document.createElement('div');d.className='qrlabel';d.dataset.c=k;d.innerHTML=`<div class="qrcat">${CATS[k].icon} ${esc(CATS[k].name)}</div><div class="qr"></div><b>${esc(e.id)}</b><small>${esc(loc(e))}</small>${k==='ext'?`<small>${esc((e.type||'').split(' (')[0])} ${e.size?esc(e.size)+' '+esc(e.unit):''}</small>`:''}`;sh.appendChild(d);
  new QRCode(d.querySelector('.qr'),{text:extUrl(e.id),width:256,height:256,correctLevel:QRCode.CorrectLevel.M})});if(!sh.children.length)sh.innerHTML='<p>ไม่มีข้อมูล</p>'};
 const fb=$('#fb'),fc=$('#fc'),rr=()=>r(fb?fb.value:'',fc?fc.value:'');rr();if(fb)fb.onchange=rr;if(fc)fc.onchange=rr}

function csv(rows){return '\uFEFF'+rows.map(r=>r.map(c=>{c=String(c??'');return /[",\n\r]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')).join('\r\n')}
function dl(name,data,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function data(){setTitle('ข้อมูล / สำรอง');let used=0;for(const k of [KEY_E,KEY_I,KEY_S])used+=(localStorage.getItem(k)||'').length;
 app.innerHTML=`<div class="card"><b>☁️ ซิงก์กับ Google Sheets (ใช้ร่วมกันในทีม)</b>
<label>Web App URL</label><input id="su" value="${esc(S.url)}" placeholder="https://script.google.com/macros/s/.../exec">
<label>รหัสทีม (Team key)</label><input id="sk" value="${esc(S.key)}" autocomplete="off">
<button class="btn ok" id="ss">🔄 ซิงก์ตอนนี้</button><button class="btn sec" id="inv">👥 ชวนเพื่อน</button>
<div class="small" id="syncinfo"></div><div id="invbox"></div></div>
<div class="card" id="catset"><b>🗂 ประเภทอุปกรณ์ที่ตรวจ</b>${CAT_KEYS.map(c=>`<label class="tgl${c===LOCKED?' locked':''}"><span>${catLabel(c)} <small class="gray">(${E.filter(e=>catOf(e)===c).length})</small></span>${c===LOCKED?'<small class="lockt">🔒 เปิดเสมอ</small>':''}<input type="checkbox" data-c="${c}" ${catOn(c)?'checked':''} ${c===LOCKED?'disabled':''}><i></i></label>`).join('')}
<p class="small gray">ปิดประเภทที่ไม่ต้องการตรวจ จะซ่อนจากหน้าหลัก รายการ ฟอร์มเพิ่ม และหน้าพิมพ์ QR เท่านั้น <b>ไม่ลบข้อมูล</b> เปิดกลับได้ทุกเมื่อ · ถังดับเพลิงต้องตรวจเสมอจึงปิดไม่ได้ · ตั้งค่าเฉพาะเครื่องนี้</p></div>
<div class="card"><b>ส่งออก CSV (เปิดใน Excel ได้)</b>${CAT_KEYS.some(c=>!catOn(c))?'<div class="small gray">ไม่รวมประเภทที่ปิดอยู่</div>':'<br>'}<button class="btn" id="ce">รายการอุปกรณ์</button><button class="btn" id="ci">ประวัติการตรวจ</button></div>
<div class="card"><b>สำรอง / กู้คืน (JSON)</b><br><button class="btn sec" id="bj">⬇ สำรองข้อมูล</button><label>กู้คืนจากไฟล์ (จะแทนที่ข้อมูลปัจจุบัน)</label><input type="file" id="rj" accept=".json,application/json"></div>
<div class="card small">อุปกรณ์ ${E.length} (${CAT_KEYS.map(c=>CATS[c].icon+E.filter(e=>catOf(e)===c).length).join(' ')}) · การตรวจ ${I.length} · ใช้พื้นที่ประมาณ ${(used*2/1048576).toFixed(2)} MB (localStorage จำกัดราว 5 MB)<br>ข้อมูลเก็บในเครื่องนี้เท่านั้น ควรสำรองข้อมูลเป็นประจำ
<br><button class="btn sec" id="dm">โหลดข้อมูลตัวอย่าง</button><button class="btn" id="wipe">ลบข้อมูลทั้งหมด</button></div>`;
 const st=today();showSync();
 document.querySelectorAll('#catset input[data-c]').forEach(x=>x.onchange=()=>{if(!setCatOn(x.dataset.c,x.checked))x.checked=true});
 const keep=()=>{const u=$('#su').value.trim(),k=$('#sk').value.trim();if(u!==S.url||k!==S.key){S.url=u;S.key=k;S.lastSync=0;save(KEY_S,S)}};
 $('#ss').onclick=()=>{keep();sync(true)};
 $('#inv').onclick=()=>{keep();if(!S.url||!S.key)return alert('กรุณากรอก URL และรหัสทีมก่อน');const link=inviteLink();
  $('#invbox').innerHTML=`<p class="small">ให้เพื่อนสแกน QR นี้ หรือส่งลิงก์ให้เปิดในโทรศัพท์ (Chrome) — <b class="red">อย่าแชร์ให้คนนอกทีม</b> เพราะมีรหัสทีมอยู่</p><div id="invqr" style="display:flex;justify-content:center"></div><input readonly value="${esc(link)}" onclick="this.select()"><button class="btn sec" id="cp">📋 คัดลอก/แชร์ลิงก์</button>`;
  new QRCode($('#invqr'),{text:link,width:200,height:200,correctLevel:QRCode.CorrectLevel.L});
  $('#cp').onclick=async()=>{try{if(navigator.share)await navigator.share({title:'ตรวจถังดับเพลิง - เข้าร่วมทีม',url:link});else{await navigator.clipboard.writeText(link);alert('คัดลอกแล้ว')}}catch{}}};
 $('#ce').onclick=()=>dl(`equipment_${st}.csv`,csv([['รหัส','ประเภท','อาคาร','ชั้น','ตำแหน่ง','ชนิด','ขนาด','หน่วย','วันติดตั้ง','วันหมดอายุ/เติมสาร','ตรวจล่าสุด','ผลล่าสุด','ครบกำหนดตรวจ','สถานะหมายเหตุ'],...EA().map(e=>{const s=status(e);const x=catOf(e)==='ext';return [e.id,CATS[catOf(e)].name,e.building,e.floor,e.spot,x?e.type:'',x?e.size:'',x?e.unit:'',e.install,x?e.expiry:'',s.last?.date,s.last?(s.last.result==='pass'?'ผ่าน':'ไม่ผ่าน'):'',s.due,e.note]})]),'text/csv;charset=utf-8');
 $('#ci').onclick=()=>dl(`inspections_${st}.csv`,csv([['วันที่','รหัสอุปกรณ์','ประเภท','ตำแหน่ง',...CHECKS.map(c=>c[1]),'รายการตรวจ (ทุกประเภท)','ผลรวม','ผู้ตรวจ','หมายเหตุ','มีรูป'],...I.filter(i=>catOn(insCat(i))).sort((a,b)=>a.date.localeCompare(b.date)).map(i=>{const e=findE(i.extId);const c=insCat(i);return [i.date,i.extId,CATS[c].name,e?loc(e):'',...CHECKS.map(([k])=>c!=='ext'?'':i.items[k]==='pass'?'ผ่าน':'ไม่ผ่าน'),catChecks(c).map(([k,t])=>t+': '+(i.items[k]==='pass'?'ผ่าน':'ไม่ผ่าน')).join('; '),i.result==='pass'?'ผ่าน':'ไม่ผ่าน',i.inspector,i.notes,i.photo?'มี':'']})]),'text/csv;charset=utf-8');
 $('#bj').onclick=()=>dl(`fire-ext-backup_${st}.json`,JSON.stringify({app:'fire-ext-app',version:1,exported:new Date().toISOString(),extinguishers:E,inspections:I,settings:S}),'application/json');
 $('#rj').onchange=async ev=>{const f=ev.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!Array.isArray(d.extinguishers)||!Array.isArray(d.inspections))throw 0;
  if(!confirm(`กู้คืน ${d.extinguishers.length} อุปกรณ์, ${d.inspections.length} การตรวจ? ข้อมูลเดิมจะถูกแทนที่`))return;E=d.extinguishers;I=d.inspections;S=d.settings||S;save(KEY_E,E);save(KEY_I,I);save(KEY_S,S);alert('กู้คืนสำเร็จ');location.hash='#/'}catch{alert('ไฟล์ไม่ถูกต้อง')}};
 $('#dm').onclick=()=>{demo();alert('เพิ่มข้อมูลตัวอย่างแล้ว');data()};
 $('#wipe').onclick=()=>{if(confirm('ลบข้อมูลทั้งหมด? (ไม่สามารถกู้คืนได้)')&&confirm('ยืนยันอีกครั้ง')){E=[];I=[];T=[];save(KEY_E,E);save(KEY_I,I);save(KEY_T,T);data()}}}

function demo(){const t=today();const add=(id,b,f,s,ty,sz,u,exp)=>{if(!findE(id))E.push({updatedAt:Date.now(),dirty:1,id,category:'ext',building:b,floor:f,spot:s,type:TYPES[ty],size:sz,unit:u,install:addDays(t,-400),expiry:addDays(t,exp),note:''})};
 const addO=(id,c,b,f,s)=>{if(!findE(id))E.push({updatedAt:Date.now(),dirty:1,id,category:c,building:b,floor:f,spot:s,type:'',size:'',unit:'',install:addDays(t,-400),expiry:'',note:''})};
 addO('EL-A-01-001','light','A','1','ทางเดินหน้าลิฟต์');addO('EL-A-02-001','light','A','2','บันไดหนีไฟ');addO('EX-A-01-001','exit','A','1','ประตูทางออกด้านหลัง');addO('EX-A-02-001','exit','A','2','ทางเดินฝั่งตะวันออก');addO('FH-A-01-001','hose','A','1','ข้างบันไดหนีไฟ');addO('FH-B-01-001','hose','B','1','ล็อบบี้');
 add('FE-A-01-001','A','1','หน้าลิฟต์โดยสาร',1,'15','lbs',300);add('FE-A-01-002','A','1','ห้องไฟฟ้า',0,'10','lbs',20);add('FE-A-02-001','A','2','ทางหนีไฟฝั่งตะวันออก',1,'15','lbs',-5);
 add('FE-A-03-001','A','3','ห้องครัว',5,'6','kg',500);add('FE-B-01-001','B','1','ล็อบบี้',2,'20','lbs',200);add('FE-B-02-001','B','2','ห้องเซิร์ฟเวอร์',4,'15','lbs',400);
 const ok=Object.fromEntries(CHECKS.map(([k])=>[k,'pass']));const ins=(id,d,res)=>I.push({id:newId(),synced:false,ts:Date.now()+Math.random()*1e6|0,extId:id,category:'ext',date:addDays(t,d),items:res?{...ok}:{...ok,gauge:'fail'},result:res?'pass':'fail',notes:res?'':'เข็มอยู่โซนแดง แจ้งเติมสาร',inspector:'สมชาย ใจดี',photo:''});
 const insO=(id,c,d,res)=>{const ok2=Object.fromEntries(catChecks(c).map(([k])=>[k,'pass']));if(!res)ok2[catChecks(c)[1][0]]='fail';I.push({id:newId(),synced:false,ts:Date.now()+Math.random()*1e6|0,extId:id,category:c,date:addDays(t,d),items:ok2,result:res?'pass':'fail',notes:res?'':'แบตเตอรี่เสื่อม แจ้งเปลี่ยน',inspector:'สมชาย ใจดี',photo:''})};
 insO('EL-A-01-001','light',-2,1);insO('EL-A-02-001','light',-5,0);insO('EX-A-01-001','exit',-40,1);insO('FH-A-01-001','hose',-4,1);
 ins('FE-A-01-001',-3,1);ins('FE-A-01-002',-26,1);ins('FE-A-02-001',-45,1);ins('FE-B-01-001',-10,0);ins('FE-B-02-001',-1,1);save(KEY_E,E);save(KEY_I,I)}

if('serviceWorker' in navigator&&location.protocol!=='file:'){let h=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(h)location.reload();h=true});navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{})}

// ---------- Google Sheets sync ----------
let syncing=false,syncTimer=null;
const b64e=s=>btoa(unescape(encodeURIComponent(s))),b64d=s=>decodeURIComponent(escape(atob(s)));
function inviteLink(){return location.origin+location.pathname+'#setup='+encodeURIComponent(b64e(JSON.stringify(Object.assign({u:S.url,k:S.key},Array.isArray(S.off)&&S.off.length?{off:S.off}:{}))))}
function acceptSetup(raw){try{const o=JSON.parse(b64d(decodeURIComponent(raw)));if(!/^(https:\/\/|http:\/\/localhost)/.test(o.u)||!o.k)throw 0;
  if(confirm('ตั้งค่าซิงก์ข้อมูลทีมกับ Google Sheets นี้?\n'+o.u)){S.url=o.u;S.key=o.k;S.lastSync=0;if(Array.isArray(o.off)){S.off=o.off.filter(c=>CATS[c]&&c!==LOCKED)}save(KEY_S,S);location.replace('#/data');sync(true)}else location.replace('#/')}
 catch{alert('ลิงก์เชิญไม่ถูกต้อง');location.replace('#/')}}
// ประเภทที่ปิดการตรวจ (เก็บใน fe_settings ของเครื่องนี้ — ซ่อนเท่านั้น ไม่ลบข้อมูล)
const LOCKED='ext'; // ถังดับเพลิงเปิดเสมอ ปิดไม่ได้
const catOn=c=>c===LOCKED||!(Array.isArray(S.off)&&S.off.includes(c));
const ON=()=>CAT_KEYS.filter(catOn);
const EA=()=>E.filter(e=>catOn(catOf(e)));
function setCatOn(c,on){if(c===LOCKED||!CATS[c])return false;const off=new Set(Array.isArray(S.off)?S.off:[]);if(on)off.delete(c);else off.add(c);
 S.off=CAT_KEYS.filter(k=>k!==LOCKED&&off.has(k));save(KEY_S,S);return true}
function offNote(c){return catOn(c)?'':`<div class="card offnote" data-c="${c}">⚠️ ประเภท <b>${catLabel(c)}</b> ถูกปิดการตรวจอยู่ในเครื่องนี้ (ซ่อนจากหน้าหลักและรายการ แต่ข้อมูลยังอยู่ครบ)<br><button class="btn" id="reon">✅ เปิดการตรวจ${CATS[c].name}อีกครั้ง</button></div>`}
function bindReon(c){const b=$('#reon');if(b)b.onclick=()=>{setCatOn(c,true);route()}}
const pending=()=>E.filter(e=>e.dirty).length+T.filter(t=>t.dirty).length+I.filter(i=>!i.synced).length;
function setSync(msg,ok){S.syncMsg=msg;S.syncOk=ok;save(KEY_S,S);showSync()}
function showSync(){const el=$('#syncinfo');if(!el)return;el.innerHTML=`สถานะ: <span class="${S.syncOk?'green':S.syncMsg?'red':'gray'}">${esc(S.syncMsg||(S.url?'ยังไม่ได้ซิงก์':'ยังไม่ได้ตั้งค่า'))}</span><br>ซิงก์ล่าสุด: ${S.lastSync?new Date(S.lastSync).toLocaleString('th-TH'):'-'} · รอส่ง: ${pending()} รายการ`}
function scheduleSync(){clearTimeout(syncTimer);syncTimer=setTimeout(()=>sync(),800)}
async function api(body){const r=await fetch(S.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({key:S.key,...body}),redirect:'follow'});
 const j=await r.json();if(!j.ok)throw new Error(j.error==='invalid key'?'รหัสทีมไม่ถูกต้อง':j.error);return j}
const clean=o=>{const x={...o};delete x.dirty;delete x.synced;delete x.catPending;delete x.chkPending;return x};
async function sync(manual){if(!S.url||!S.key){if(manual)alert('กรุณาตั้งค่า Web App URL และรหัสทีม');return}
 if(!navigator.onLine){setSync('ออฟไลน์ — จะส่งข้อมูลเมื่อกลับมาออนไลน์',false);return}
 if(syncing){scheduleSync();return}syncing=true;setSync('กำลังซิงก์...',true);
 try{const up=I.filter(i=>!i.synced||(i.chkPending&&S.insChecks!==false));
  for(let n=0;n<up.length;n+=5){const batch=up.slice(n,n+5);await api({action:'appendInspections',inspections:batch.map(i=>{const x=clean(i);if(i.synced&&x.photoUrl)delete x.photo;return x})});batch.forEach(i=>i.synced=true);save(KEY_I,I)}
  const sent=[...E.filter(e=>e.dirty||(e.photo&&!e.photoUrl&&S.extPhoto!==false)||(e.catPending&&S.extCat!==false)).map(e=>{const x=clean(e);if(x.photoUrl||!x.photo)delete x.photo;return x}),...T.filter(t=>t.dirty).map(t=>({id:t.id,deleted:1,updatedAt:t.updatedAt}))];
  const res=await api({action:'sync',extinguishers:sent,inspections:[]});merge(res);
  S.lastSync=Date.now();setSync('ซิงก์สำเร็จ ✓ ('+E.length+' อุปกรณ์, '+I.length+' การตรวจ)'+(S.extCat===false||S.insChecks===false?' ⚠️ Apps Script ยังเป็นเวอร์ชันเก่า (ยังไม่รองรับประเภทอุปกรณ์)':''),true);
  const p=(location.hash.split('/')[1]||'');if(['','list','ext','qr'].includes(p)&&!location.hash.startsWith('#id'))route();
 }catch(err){setSync('ซิงก์ไม่สำเร็จ: '+(err.message||err),false)}finally{syncing=false}}
function merge(res){const rows=res.extinguishers||[],irows=res.inspections||[];if(rows.length){S.extPhoto=rows.some(r=>'photoUrl' in r);S.extCat=rows.some(r=>'category' in r)}if(irows.length)S.insChecks=irows.some(r=>'checks' in r);const L=new Map(E.map(e=>[e.id,e])),TM=new Map(T.map(t=>[t.id,t]));
 for(const s of res.extinguishers||[]){const id=String(s.id),l=L.get(id),t=TM.get(id),lu=Math.max(l?.updatedAt||0,t?.updatedAt||0),su=Number(s.updatedAt)||0;
  if(su<lu)continue;
  if(Number(s.deleted)){L.delete(id);TM.set(id,{id,updatedAt:su})}else{const x={...s,id,updatedAt:su};delete x.deleted;
   if(l){if(!('photoUrl' in s)){x.photo=l.photo;x.photoUrl=l.photoUrl;x.photoRemoved=l.photoRemoved}else if(l.photo&&!l.photoRemoved&&(s.photoUrl===l.photoUrl||su===l.updatedAt||/^ERROR/.test(s.photoUrl)))x.photo=l.photo}
   if(!x.photoUrl)delete x.photoRemoved;
   // ประเภทอุปกรณ์: Apps Script เก่าไม่มีคอลัมน์ category -> เก็บค่าในเครื่องไว้แล้วส่งซ้ำเมื่ออัปเดตสคริปต์
   const lc=l&&CATS[l.category]&&l.category!=='ext'?l.category:'';
   if(!('category' in s)){if(l&&'category' in l)x.category=l.category;if(lc)x.catPending=1}
   else if(!CATS[s.category]&&lc&&su===l.updatedAt){x.category=lc;x.catPending=1}
   L.set(id,x);TM.delete(id)}}
 E=[...L.values()];T=[...TM.values()];
 const LI=new Map(I.map(i=>[String(i.id),i]));
 for(const s of irows){const l=LI.get(String(s.id));if(l){l.synced=true;if(s.photoUrl)l.photoUrl=s.photoUrl;
  const lc=insCat(l);if(lc!=='ext'&&!(s.checks&&CATS[s.category]))l.chkPending=1;else delete l.chkPending}
  else{const x={...s,id:String(s.id),ts:Number(s.ts)||Date.parse(s.date)||0,synced:true,photo:''};if(!CATS[x.category])delete x.category;delete x.checks;I.push(x)}}
 save(KEY_E,E);save(KEY_T,T);save(KEY_I,I)}
addEventListener('online',()=>sync());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-(S.lastSync||0)>60000)sync()});

route();
if(!location.hash.startsWith('#setup='))sync();
