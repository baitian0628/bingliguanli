// ==============================
// API 封装
// ==============================
const API = {
  async get(url) {
    const res = await fetch(url); if (!res.ok) { const b = await res.json().catch(()=>({})); throw new Error(b.error||`错误: ${res.status}`); }
    return res.json();
  },
  async post(url, data) {
    const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    if (!res.ok) { const b = await res.json().catch(()=>({})); throw new Error(b.error||`错误: ${res.status}`); }
    return res.json();
  },
  async put(url, data) {
    const res = await fetch(url, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    if (!res.ok) { const b = await res.json().catch(()=>({})); throw new Error(b.error||`错误: ${res.status}`); }
    return res.json();
  },
  async del(url) {
    const res = await fetch(url, { method:'DELETE' });
    if (!res.ok) { const b = await res.json().catch(()=>({})); throw new Error(b.error||`错误: ${res.status}`); }
    return res.json();
  },
  async upload(url, fd) {
    const res = await fetch(url, { method:'POST', body:fd });
    if (!res.ok) { const b = await res.json().catch(()=>({})); throw new Error(b.error||`错误: ${res.status}`); }
    return res.json();
  },
  async download(url, data) {
    const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    if (!res.ok) return { success:false };
    const blob = await res.blob();
    const fn = (res.headers.get('Content-Disposition')||'').match(/filename\*?=(?:UTF-8'')?([^;\s]+)/);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = fn ? decodeURIComponent(fn[1]) : '导出.xlsx'; a.click(); URL.revokeObjectURL(a.href);
    return { success:true };
  }
};

// ==============================
// 页面导航
// ==============================
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page' + name.charAt(0).toUpperCase() + name.slice(1));
  if (page) page.classList.add('active');
}

async function handleHash() {
  const hash = window.location.hash.replace('#','') || 'login';
  const parts = hash.split('/');
  if (parts[0] === 'main') { showPage('main'); await loadVillages(); }
  else if (parts[0] === 'detail') { showPage('detail'); await loadDetail(Number(parts[1])); }
  else if (parts[0] === 'form') {
    showPage('form');
    await initForm(parts[1]==='new'?null:Number(parts[1]), parts[1]==='new'?Number(parts[2]):null);
  } else { showPage('login'); }
}
window.addEventListener('hashchange', handleHash);
handleHash();

document.getElementById('detailBack').addEventListener('click', e=>{e.preventDefault();window.location.hash='main';});
document.getElementById('formBack').addEventListener('click', e=>{e.preventDefault();window.location.hash='main';});
document.getElementById('formCancelBtn').addEventListener('click', ()=>{window.location.hash='main';});

// ==============================
// 工具函数
// ==============================
function esc(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function debounce(fn,d){ let t; return function(...a){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a),d); }; }

// ==============================
// 登录逻辑
// ==============================
(function(){
  const loginBtn=document.getElementById('loginBtn');
  const userInp=document.getElementById('usernameInput');

  API.get('/api/settings/username').then(r=>{ if(r.value) userInp.value=r.value; }).catch(()=>{});

  loginBtn.addEventListener('click',()=>{ window.location.hash='main'; });
})();

// ==============================
// 主页面
// ==============================
let curVid=null, curVname='';
let filterConditions=[];
let sortBy='date', sortDir='desc';  // 默认按日期倒序

// 加载用户名显示
API.get('/api/settings/username').then(r=>{ if(r.value){ const e=document.querySelector('.user-info'); if(e)e.textContent=r.value; } }).catch(()=>{});

async function selectVillage(id,name){
  curVid=id; curVname=name; filterConditions=[];
  document.getElementById('titleArea').innerHTML=`${esc(name)} <span class="patient-count" id="patientCount"></span>`;
  renderFilterTags();
  await loadVillages();
  await loadPatients();
}

async function showVillageMenu(e,v){
  const overlay=document.createElement('div'); overlay.className='modal-overlay';
  overlay.innerHTML=`<div class="modal" style="width:360px;">
    <div class="modal-header"><span>管理村庄</span><span class="modal-close">&times;</span></div>
    <div class="modal-body">
      <div class="form-group"><label>村庄名称</label><input class="input" id="villageEditName" value="${esc(v.name)}" style="width:100%;"></div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary btn-sm" id="villageSaveBtn">保存</button>
        <button class="btn btn-danger btn-sm" id="villageDelBtn">删除村庄</button>
      </div>
    </div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').onclick=()=>overlay.remove();
  overlay.addEventListener('click',ev=>{if(ev.target===overlay)overlay.remove();});
  overlay.querySelector('#villageSaveBtn').addEventListener('click',async()=>{
    const name=overlay.querySelector('#villageEditName').value.trim();
    if(!name)return;
    await API.put('/api/villages/'+v.id,{name});
    overlay.remove(); await loadVillages();
  });
  overlay.querySelector('#villageDelBtn').addEventListener('click',async()=>{
    if(v.id===1){ alert('「其他」村庄不可删除'); return; }
    if(!confirm(`确定删除村庄「${v.name}」？\n该村庄的病人将自动移入「其他」村庄。`))return;
    await API.del('/api/villages/'+v.id);
    if(curVid===v.id){ curVid=1; curVname='其他'; document.getElementById('titleArea').innerHTML='其他 <span class="patient-count" id="patientCount"></span>'; loadPatients(); }
    overlay.remove(); await loadVillages();
  });
}

document.getElementById('addVillageBtn').addEventListener('click',async()=>{
  const name=prompt('请输入村庄名称：'); if(!name||!name.trim())return;
  await API.post('/api/villages',{name:name.trim()}); await loadVillages();
});

// ====== 合并村庄 ======
let mergeMode=false, mergeSelected=[];
document.getElementById('mergeVillageBtn').addEventListener('click',()=>{
  mergeMode=!mergeMode; mergeSelected=[];
  document.getElementById('mergeVillageBtn').textContent=mergeMode?'取消合并':'合并村庄';
  document.getElementById('mergeVillageBtn').style.background=mergeMode?'#E74C3C':'';
  document.getElementById('mergeVillageBtn').style.color=mergeMode?'white':'';
  loadVillages();
});

async function loadVillages(){
  const search=document.getElementById('villageSearch').value.trim();
  const villages=await API.get('/api/villages?search='+encodeURIComponent(search));
  const listEl=document.getElementById('villageList');
  listEl.innerHTML='';
  if(!villages.length){ listEl.innerHTML='<div class="empty-state" style="padding:24px;"><p style="font-size:13px;">暂无村庄</p></div>'; return; }
  for(const v of villages){
    const div=document.createElement('div');
    div.className='village-item'+(v.id===curVid?' active':'');
    if(mergeMode){
      const checked=mergeSelected.includes(v.id);
      div.innerHTML=`<input type="checkbox" style="margin-right:8px;" ${checked?'checked':''} data-vid="${v.id}"> <span>${esc(v.name)}</span>`;
      div.querySelector('input').addEventListener('change',function(){
        if(this.checked) mergeSelected.push(v.id); else mergeSelected=mergeSelected.filter(x=>x!==v.id);
        updateMergeButton();
      });
    } else {
      div.innerHTML=`<span style="flex:1;" class="vname">${esc(v.name)}</span>
        <span style="display:flex;gap:2px;opacity:0.4;" class="v-arrows">
          <button class="btn-text" style="font-size:10px;padding:0 2px;" data-move="${v.id}" data-dir="up" title="上移">&#9650;</button>
          <button class="btn-text" style="font-size:10px;padding:0 2px;" data-move="${v.id}" data-dir="down" title="下移">&#9660;</button>
        </span>`;
      div.querySelector('.vname').onclick=()=>selectVillage(v.id,v.name);
      div.querySelector('.vname').oncontextmenu=e=>{ e.preventDefault(); showVillageMenu(e,v); };
      div.querySelectorAll('[data-move]').forEach(btn=>{
        btn.addEventListener('click',async e=>{
          e.stopPropagation();
          await API.post('/api/villages/'+v.id+'/move',{direction:btn.dataset.dir});
          await loadVillages();
        });
      });
    }
    div.style.display='flex'; div.style.alignItems='center';
    listEl.appendChild(div);
  }
  updateMergeButton();
}

function updateMergeButton(){
  const listEl=document.getElementById('villageList');
  const existing=document.getElementById('doMergeBtn');
  if(mergeMode&&mergeSelected.length>1){
    if(!existing){
      const btn=document.createElement('button');
      btn.className='btn btn-primary btn-sm';
      btn.id='doMergeBtn';
      btn.style.cssText='width:100%;margin-top:8px;';
      btn.textContent=`合并选中村庄 (${mergeSelected.length}个)`;
      btn.addEventListener('click',doMerge);
      listEl.appendChild(btn);
    } else {
      existing.textContent=`合并选中村庄 (${mergeSelected.length}个)`;
    }
  } else {
    if(existing) existing.remove();
  }
}

async function doMerge(){
  if(mergeSelected.length<2){ alert('至少选择两个村庄进行合并'); return; }
  const villages=await API.get('/api/villages');
  let msg='选择合并到哪个村庄：\n\n';
  const selVillages=villages.filter(v=>mergeSelected.includes(v.id));
  for(let i=0;i<selVillages.length;i++){
    msg+=`${i+1}. ${selVillages[i].name}\n`;
  }
  const choice=prompt(msg+'请输入序号（如输入1）：');
  const idx=parseInt(choice)-1;
  if(isNaN(idx)||idx<0||idx>=selVillages.length){ alert('无效选择'); return; }
  const target=selVillages[idx];
  const sources=mergeSelected.filter(id=>id!==target.id);
  if(!confirm(`将 ${sources.length} 个村庄的病人合并到「${target.name}」？\n源村庄将被删除。`))return;
  await API.post('/api/villages/merge',{source_ids:sources,target_id:target.id});
  mergeMode=false; mergeSelected=[];
  document.getElementById('mergeVillageBtn').textContent='合并村庄';
  document.getElementById('mergeVillageBtn').style.background='';
  document.getElementById('mergeVillageBtn').style.color='';
  await loadVillages();
  if(curVid&&sources.includes(curVid)) selectVillage(target.id,target.name);
}

document.getElementById('villageSearch').addEventListener('input',debounce(loadVillages,300));

// ====== 筛选浮层 ======
let filterPanelOpen=false;
document.getElementById('toggleFilterBtn').addEventListener('click',()=>{
  if(!curVid){ alert('请先选择村庄'); return; }
  filterPanelOpen=!filterPanelOpen;
  document.getElementById('filterPanel').style.display=filterPanelOpen?'block':'none';
  if(filterPanelOpen) renderFilterPanel();
});
document.getElementById('closeFilterBtn').addEventListener('click',()=>{
  filterPanelOpen=false; document.getElementById('filterPanel').style.display='none';
});
document.getElementById('addFilterCondBtn').addEventListener('click',()=>{
  filterConditions.push({field:'name',val:''}); renderFilterPanel();
});
document.getElementById('applyFilterBtn').addEventListener('click',()=>{
  renderFilterTags(); loadPatients();
});
document.getElementById('clearFilterBtn').addEventListener('click',()=>{
  filterConditions=[]; renderFilterPanel(); renderFilterTags(); loadPatients();
});

async function renderFilterPanel(){
  const customFields=await API.get('/api/custom-fields');
  const fields=[{key:'name',label:'姓名'},{key:'gender',label:'性别'},{key:'age',label:'年龄'},{key:'phone',label:'电话'},{key:'address',label:'住址'},{key:'date',label:'日期'},{key:'condition',label:'病情'},{key:'remark',label:'备注'}];
  for(const cf of customFields){ fields.push({key:'custom_'+cf.id,label:cf.name}); }
  const container=document.getElementById('filterConditionsList');
  if(!filterConditions.length){ container.innerHTML='<p style="color:#A0BBD0;font-size:12px;">暂无筛选条件</p>'; return; }
  let html='';
  filterConditions.forEach((fc,i)=>{
    const isDate=fc.field==='date';
    const isCustom=fc.field&&fc.field.startsWith('custom_');
    html+=`<div style="background:white;border-radius:6px;padding:10px;margin-bottom:8px;border:1px solid #E8ECF1;position:relative;">
      <span style="position:absolute;top:4px;right:8px;cursor:pointer;color:#ccc;font-size:14px;" data-rm="${i}">&times;</span>
      <select class="select" data-idx="${i}" data-key="field" style="width:100%;font-size:11px;margin-bottom:6px;">`;
    for(const f of fields) html+=`<option value="${f.key}" ${fc.field===f.key?'selected':''}>${f.label}</option>`;
    html+=`</select>`;
    if(isDate){
      html+=`<input type="date" class="input" data-idx="${i}" data-key="val" value="${esc(fc.val)}" style="width:100%;font-size:12px;padding:6px 8px;">`;
    } else {
      html+=`<input class="input" data-idx="${i}" data-key="val" value="${esc(fc.val)}" placeholder="输入筛选值..." style="width:100%;font-size:12px;padding:6px 8px;">`;
    }
    html+=`</div>`;
  });
  container.innerHTML=html;
  container.querySelectorAll('[data-rm]').forEach(s=>{ s.addEventListener('click',function(){ filterConditions.splice(parseInt(this.dataset.rm),1); renderFilterPanel(); }); });
  container.querySelectorAll('select').forEach(s=>{ s.addEventListener('change',function(){ filterConditions[this.dataset.idx].field=this.value; renderFilterPanel(); }); });
  container.querySelectorAll('input').forEach(i=>{ i.addEventListener('input',function(){ filterConditions[this.dataset.idx].val=this.value; }); });
}

async function renderFilterTags(){
  const container=document.getElementById('filterTags');
  const labels={name:'姓名',age:'年龄',phone:'电话',address:'住址',date:'日期',condition:'病情',gender:'性别',remark:'备注'};
  // Add custom field labels
  const customFields=await API.get('/api/custom-fields');
  for(const cf of customFields){ labels['custom_'+cf.id]=cf.name; }
  const active=filterConditions.filter(fc=>fc.val);
  if(!active.length){ container.innerHTML=''; return; }
  container.innerHTML=active.map((fc,i)=>`<span style="display:inline-flex;align-items:center;background:#E8F0FF;color:#2A5A8C;border-radius:3px;padding:1px 6px;font-size:11px;gap:3px;">${labels[fc.field]||fc.field}: ${esc(fc.val)}<span style="cursor:pointer;" data-rt="${i}">&times;</span></span>`).join('');
  container.querySelectorAll('[data-rt]').forEach(s=>{ s.addEventListener('click',function(){ filterConditions.splice(parseInt(this.dataset.rt),1); renderFilterPanel(); renderFilterTags(); loadPatients(); }); });
}

// ====== 病人列表 ======
async function loadPatients(){
  if(!curVid)return;
  const params=new URLSearchParams(); params.set('village_id',curVid);
  params.set('sort_by', sortBy);
  params.set('sort_dir', sortDir);
  for(const fc of filterConditions){
    if(!fc.val) continue;
    if(fc.field&&fc.field.startsWith('custom_')){
      params.set('custom_field_id', fc.field.replace('custom_',''));
      params.set('custom_field_value', fc.val);
    } else {
      params.set(fc.field, fc.val);
    }
  }
  const patients=await API.get('/api/patients?'+params.toString());
  const container=document.getElementById('tableContainer');
  if(!patients.length){ container.innerHTML='<div class="empty-state"><div class="icon">&#x1f4cb;</div><p>暂无病人记录</p></div>'; }
  else { await renderTable(patients); }
  const cnt=document.getElementById('patientCount'); if(cnt)cnt.textContent=`${new Set(patients.map(p=>p.name)).size}人 / ${patients.length}条记录`;
}

let multiSelectMode=false, selectedPatients=[];
async function renderTable(patients){
  const conditions=await API.get('/api/conditions');
  const cMap={}; for(const c of conditions){ try{cMap[c.name]=JSON.parse(c.color);}catch(e){cMap[c.name]={bg:'#EEE',text:'#666'}}}
  function sortArrow(col){
    if(sortBy!==col) return ' <span style="color:#ccc;">&#9650;&#9660;</span>';
    return sortDir==='asc'?' <span style="color:#4A90D9;">&#9650;</span>':' <span style="color:#4A90D9;">&#9660;</span>';
  }
  function sortHeader(label, col){
    return `<th style="cursor:pointer;user-select:none;" onclick="window.toggleSort('${col}')">${label}${sortArrow(col)}</th>`;
  }
  const cols=getVisibleKeys();
  let html='<div class="table-wrapper"><table><thead><tr>';
  if(multiSelectMode) html+=`<th style="width:36px;"><input type="checkbox" id="selectAllCheckbox" title="全选"></th>`;
  for(const c of allColumns){
    if(!visibleColumns[c.key]) continue;
    if(c.key==='name') html+=sortHeader('姓名','name');
    else if(c.key==='age') html+=sortHeader('年龄','age');
    else if(c.key==='visit_date') html+=sortHeader('看病日期','date');
    else html+=`<th>${c.label}</th>`;
  }
  html+=`<th>操作</th></tr></thead><tbody>`;
  // 获取所有病人的自定义字段值
  const fieldValues={};
  for(const p of patients){
    try{
      const vals=await API.get('/api/patients/'+p.id+'/fields');
      fieldValues[p.id]={};
      for(const v of vals) fieldValues[p.id]['custom_'+v.field_id]=v.value;
    }catch(e){}
  }

  const cellRenderers={
    name:p=>esc(p.name),
    gender:p=>p.gender||'-',
    age:p=>p.age||'-',
    phone:p=>esc(p.phone)||'-',
    address:p=>esc(p.address)||'-',
    visit_date:p=>p.visit_date||'-',
    condition:p=>{const c=cMap[p.condition]||{bg:'#EEE',text:'#666'};return `<span class="tag" style="background:${c.bg};color:${c.text}">${esc(p.condition)||'-'}</span>`;}
  };
  for(const p of patients){
    html+=`<tr>`;
    if(multiSelectMode){
      const checked=selectedPatients.includes(p.id);
      html+=`<td><input type="checkbox" class="patient-checkbox" data-pid="${p.id}" ${checked?'checked':''}></td>`;
    }
    for(const c of allColumns){
      if(!visibleColumns[c.key]) continue;
      if(cellRenderers[c.key]){
        html+=`<td>${cellRenderers[c.key](p)}</td>`;
      } else {
        html+=`<td>${esc((fieldValues[p.id]||{})[c.key]||'-')}</td>`;
      }
    }
    html+=`<td class="ops-cell"><button class="btn-text" data-a="view" data-id="${p.id}">查看</button><button class="btn-text" data-a="edit" data-id="${p.id}">编辑</button><button class="btn-text" data-a="del" data-id="${p.id}" style="color:#E74C3C;">删除</button></td></tr>`;
  }
  html+='</tbody></table></div>';
  document.getElementById('tableContainer').innerHTML=html;

  // 全选
  const selectAll=document.getElementById('selectAllCheckbox');
  if(selectAll){
    selectAll.addEventListener('change',function(){
      if(this.checked) selectedPatients=patients.map(p=>p.id);
      else selectedPatients=[];
      renderTable(patients);
    });
  }
  // 单行选择
  document.querySelectorAll('.patient-checkbox').forEach(cb=>{
    cb.addEventListener('change',function(){
      const pid=Number(this.dataset.pid);
      if(this.checked) selectedPatients.push(pid);
      else selectedPatients=selectedPatients.filter(x=>x!==pid);
      updateMultiSelectUI();
    });
  });

  document.querySelectorAll('[data-a]').forEach(b=>{ b.addEventListener('click',async e=>{ e.stopPropagation(); const a=b.dataset.a,id=Number(b.dataset.id); if(a==='view')window.location.hash='detail/'+id; else if(a==='edit')window.location.hash='form/'+id; else if(a==='del'){ if(!confirm('确定删除该病人？'))return; await API.del('/api/patients/'+id); await loadPatients(); } }); });

function bindImportFieldEvents(overlay, buildMapHtmlFn, afterRebuild){
  overlay.querySelectorAll('[data-rm]').forEach(btn=>{
    btn.onclick=function(){
      const idx=parseInt(this.dataset.rm);
      window._importFields.splice(idx,1);
      const area=overlay.querySelector('#importMappingArea');
      area.innerHTML=buildMapHtmlFn();
      bindImportFieldEvents(overlay, buildMapHtmlFn, afterRebuild);
      if(afterRebuild) afterRebuild();
    };
  });
}

  updateMultiSelectUI();
}

async function updateMultiSelectUI(){
  const toolbar=document.getElementById('multiSelectToolbar');
  if(!toolbar)return;
  if(multiSelectMode&&selectedPatients.length>0){
    toolbar.style.display='flex';
    if(curVid){
      const all=await API.get('/api/patients?village_id='+curVid);
      const selectedSet=new Set(selectedPatients);
      const selectedData=all.filter(p=>selectedSet.has(p.id));
      const uniqueNames=new Set(selectedData.map(p=>p.name)).size;
      toolbar.querySelector('#batchCount').textContent=uniqueNames;
      toolbar.querySelector('#batchRecordCount').textContent=selectedPatients.length;
    }
  } else if(multiSelectMode){
    toolbar.style.display='flex';
    toolbar.querySelector('#batchCount').textContent='0';
    toolbar.querySelector('#batchRecordCount').textContent='0';
  } else {
    toolbar.style.display='none';
  }
}

window.toggleSort=function(col){
  if(sortBy===col) sortDir=sortDir==='asc'?'desc':'asc';
  else { sortBy=col; sortDir=col==='age'?'asc':'desc'; }
  loadPatients();
};

document.getElementById('toggleMultiBtn').addEventListener('click',()=>{
  multiSelectMode=!multiSelectMode;
  selectedPatients=[];
  document.getElementById('toggleMultiBtn').textContent=multiSelectMode?'退出多选':'多选模式';
  document.getElementById('toggleMultiBtn').style.background=multiSelectMode?'#E74C3C':'';
  document.getElementById('toggleMultiBtn').style.color=multiSelectMode?'white':'';
  loadPatients();
});

document.getElementById('batchDelBtn').addEventListener('click',async()=>{
  if(!selectedPatients.length)return;
  if(!confirm(`确定删除选中的 ${selectedPatients.length} 位病人？此操作不可恢复。`))return;
  await API.post('/api/patients/batch-delete',{ids:selectedPatients});
  selectedPatients=[];
  await loadPatients();
});

document.getElementById('batchMoveBtn').addEventListener('click',async()=>{
  if(!selectedPatients.length)return;
  const villages=await API.get('/api/villages');
  let list=villages.filter(v=>v.id!==curVid).map((v,i)=>`${i+1}. ${v.name}`).join('\n');
  const choice=prompt(`选择目标村庄（输入序号）：\n\n${list}`);
  const otherVillages=villages.filter(v=>v.id!==curVid);
  const idx=parseInt(choice)-1;
  if(isNaN(idx)||idx<0||idx>=otherVillages.length){ alert('无效选择'); return; }
  if(!confirm(`将 ${selectedPatients.length} 位病人移动到「${otherVillages[idx].name}」？`))return;
  await API.post('/api/patients/batch-move',{ids:selectedPatients,target_village_id:otherVillages[idx].id});
  selectedPatients=[];
  await loadPatients();
});

document.getElementById('selectAllBtn').addEventListener('click',async()=>{
  if(!curVid)return;
  const all=await API.get('/api/patients?village_id='+curVid);
  selectedPatients=all.map(p=>p.id);
  await loadPatients();
});

// ====== 列显示控制 ======
let visibleColumns={name:true,gender:true,age:true,phone:true,address:true,visit_date:true,condition:true};
const baseColumns=[
  {key:'name',label:'姓名'},{key:'gender',label:'性别'},{key:'age',label:'年龄'},
  {key:'phone',label:'电话'},{key:'address',label:'住址'},{key:'visit_date',label:'看病日期'},
  {key:'condition',label:'病情'}
];
let allColumns=[...baseColumns];

async function refreshAllColumns(){
  const customFields=await API.get('/api/custom-fields');
  // 加载保存的列顺序
  let savedOrder=null;
  try{
    const r=await API.get('/api/settings/column_order');
    if(r.value) savedOrder=r.value.split(',');
  }catch(e){}
  // 构建完整列列表
  const newCols=[...baseColumns];
  for(const cf of customFields){
    const key='custom_'+cf.id;
    newCols.push({key,label:cf.name});
    if(!(key in visibleColumns)) visibleColumns[key]=true;
  }
  // 按保存的顺序排列
  if(savedOrder){
    const orderMap={};
    savedOrder.forEach((k,i)=>orderMap[k]=i);
    newCols.sort((a,b)=>{
      const ai=orderMap[a.key]!==undefined?orderMap[a.key]:999;
      const bi=orderMap[b.key]!==undefined?orderMap[b.key]:999;
      return ai-bi;
    });
  }
  allColumns=newCols;
}

document.getElementById('columnVisBtn').addEventListener('click',async()=>{
  await refreshAllColumns();
  let html='';
  allColumns.forEach((c,i)=>{
    html+=`<div class="col-item" draggable="true" data-idx="${i}" style="display:flex;align-items:center;gap:6px;padding:6px 8px;cursor:grab;border-radius:4px;margin:2px 0;">
      <span style="color:#ccc;cursor:grab;">&#9776;</span>
      <input type="checkbox" ${visibleColumns[c.key]?'checked':''} data-col="${c.key}">
      <span style="flex:1;font-size:13px;">${c.label}</span>
    </div>`;
  });
  const overlay=document.createElement('div'); overlay.className='modal-overlay';
  overlay.innerHTML=`<div class="modal" style="width:320px;"><div class="modal-header"><span>列显示与排序 <span style="font-size:10px;color:#ccc;">(拖拽&#9776;排序)</span></span><span class="modal-close">&times;</span></div><div class="modal-body">${html}</div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').onclick=()=>overlay.remove();
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  // 复选框
  overlay.querySelectorAll('input[data-col]').forEach(cb=>{
    cb.addEventListener('change',function(){
      visibleColumns[this.dataset.col]=this.checked;
      loadPatients();
    });
  });
  // 拖拽排序
  let dragSrc=null;
  overlay.querySelectorAll('.col-item').forEach(item=>{
    item.addEventListener('dragstart',function(e){ dragSrc=this; this.style.opacity='0.5'; e.dataTransfer.effectAllowed='move'; });
    item.addEventListener('dragend',function(){ this.style.opacity='1'; overlay.querySelectorAll('.col-item').forEach(i=>i.style.borderTop=''); });
    item.addEventListener('dragover',function(e){ e.preventDefault(); e.dataTransfer.dropEffect='move'; this.style.borderTop='2px solid #4A90D9'; });
    item.addEventListener('dragleave',function(){ this.style.borderTop=''; });
    item.addEventListener('drop',function(e){
      e.preventDefault(); this.style.borderTop='';
      if(dragSrc===this)return;
      const from=parseInt(dragSrc.dataset.idx),to=parseInt(this.dataset.idx);
      const item=allColumns.splice(from,1)[0];
      allColumns.splice(to,0,item);
      // 保存顺序
      API.put('/api/settings/column_order',{value:allColumns.map(c=>c.key).join(',')});
      overlay.remove(); document.getElementById('columnVisBtn').click();
    });
  });
});

function getVisibleKeys(){
  return allColumns.filter(c=>visibleColumns[c.key]).map(c=>c.key);
}

document.getElementById('addPatientBtn').addEventListener('click',()=>{ if(!curVid){ alert('请先选择村庄'); return; } window.location.hash='form/new/'+curVid; });
document.getElementById('exportBtn').addEventListener('click',async()=>{
  if(!curVid){ alert('请先选择村庄'); return; }
  const patients=await API.get('/api/patients?village_id='+curVid);
  if(!patients.length){ alert('无数据'); return; }
  const cols=getVisibleKeys().map(k=>{ const c=allColumns.find(x=>x.key===k); return {key:k,label:c?c.label:k}; });
  cols.push({key:'photos',label:'病历照片'});
  await API.download('/api/export',{village_name:curVname,patients,columns:cols});
});

// ====== Excel 导入 ======
document.getElementById('importBtn').addEventListener('click',()=>{
  if(!curVid){ alert('请先选择村庄'); return; }
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.xlsx,.xls';
  inp.onchange=async()=>{
    if(!inp.files[0])return;
    const fd=new FormData(); fd.append('file',inp.files[0]);
    const preview=await API.upload('/api/import/preview',fd);
    if(preview.error){ alert(preview.error); return; }
    showImportPreview(preview);
  };
  inp.click();
});

async function showImportPreview(data){
  // 构建字段列表：当前村庄可见列顺序优先
  const visible=getVisibleKeys();
  const baseFields=[
    {key:'name',label:'姓名'},{key:'gender',label:'性别'},{key:'age',label:'年龄'},
    {key:'phone',label:'电话'},{key:'address',label:'住址'},{key:'visit_date',label:'日期'},
    {key:'condition',label:'病情'},{key:'remark',label:'备注'}
  ];
  const customFields=await API.get('/api/custom-fields');
  for(const cf of customFields){ baseFields.push({key:'custom_'+cf.id,label:cf.name}); }

  const fieldMap={};
  for(const f of baseFields){ fieldMap[f.key]=f; }
  let fields=[];
  for(const k of visible){ if(fieldMap[k]){ fields.push(fieldMap[k]); delete fieldMap[k]; } }
  for(const k in fieldMap){ fields.push(fieldMap[k]); }

  // 自动匹配
  const autoMatch={};
  for(const f of fields){
    for(let i=0;i<data.headers.length;i++){
      const h=data.headers[i].replace(/\s+/g,'');
      const fl=f.label.replace(/\s+/g,'');
      if(h===fl||h.includes(fl)||fl.includes(h)){ autoMatch[f.key]=i; break; }
    }
  }
  window._importFields=fields;  // 保存引用供增删操作

  function buildMapHtml(){
    let mapHtml='<div id="importFieldList">';
    window._importFields.forEach((f,idx)=>{
      const matched=autoMatch[f.key]!==undefined?autoMatch[f.key]:'';
      mapHtml+=`<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #F0F2F5;">
        <span style="flex:1;font-size:12px;">${esc(f.label)}${matched!==''?' <span style=\"color:#3A7D5C;font-size:10px;\">&#10003;</span>':''}</span>
        <select class="select" data-map="${f.key}" style="width:180px;font-size:11px;"><option value="">不导入</option>`;
      for(let i=0;i<data.headers.length;i++){
        mapHtml+=`<option value="${i}" ${matched===i?'selected':''}>${esc(data.headers[i]||'列'+i)}</option>`;
      }
      mapHtml+=`</select><button class="btn-text" style="color:#E74C3C;font-size:16px;" data-rm="${idx}">&times;</button></div>`;
    });
    mapHtml+=`</div>`;
    return mapHtml;
  }

  function updateMatchFields(){
    const container=overlay.querySelector('#matchFieldsCheckboxes');
    if(!container) return;
    const modeRadio=overlay.querySelector('input[name="importMode"][value="replace"]');
    if(!modeRadio||!modeRadio.checked) return;
    const mappedKeys=[];
    overlay.querySelectorAll('[data-map]').forEach(s=>{
      if(s.value!==''){
        const labelEl=s.parentElement.querySelector('span');
        mappedKeys.push({key:s.dataset.map, label:labelEl?labelEl.textContent.replace(/\s*✓\s*/,'').trim():s.dataset.map});
      }
    });
    let html='';
    for(const f of mappedKeys){
      const defaultChecked=f.key==='name'?'checked':'';
      html+=`<label style="display:inline-flex;align-items:center;gap:3px;font-size:12px;cursor:pointer;background:white;padding:3px 8px;border-radius:4px;border:1px solid #E8ECF1;">
        <input type="checkbox" value="${f.key}" ${defaultChecked}> ${esc(f.label)}
      </label>`;
    }
    container.innerHTML=html||'<span style="font-size:11px;color:#A0BBD0;">暂无映射字段，请先在上方设置字段映射</span>';
  }
  window._updateMatchFields=updateMatchFields;

  let mapHtml=`<div id="importMappingArea">${buildMapHtml()}
    <div style="display:flex;gap:4px;margin-top:8px;">
      <input class="input" id="importNewField" placeholder="新字段名" style="flex:1;font-size:11px;padding:4px 8px;">
      <select class="select" id="importNewSection" style="width:90px;font-size:11px;"><option value="extra">附加信息</option><option value="basic">基本信息</option><option value="visit">看病记录</option></select>
      <button class="btn btn-outline btn-sm" id="importAddFieldBtn">+ 添加</button>
    </div></div>`;

  let previewHtml='<div style="max-height:200px;overflow:auto;margin-bottom:12px;"><table style="width:100%;font-size:11px;"><tr>';
  for(const h of data.headers){ previewHtml+=`<th style="padding:4px 6px;">${esc(h||'')}</th>`; }
  previewHtml+='</tr>';
  for(let i=0;i<Math.min(data.rows.length,5);i++){
    previewHtml+='<tr>';
    for(const cell of data.rows[i]){ previewHtml+=`<td style="padding:4px 6px;">${esc(cell)}</td>`; }
    previewHtml+='</tr>';
  }
  previewHtml+=`</table></div><p style="font-size:12px;color:#888;">共 ${data.count} 条数据，仅显示前 5 条</p>`;

  const overlay=document.createElement('div'); overlay.className='modal-overlay';
  overlay.innerHTML=`<div class="modal" style="width:700px;max-height:90vh;overflow-y:auto;">
    <div class="modal-header"><span>导入 Excel - 预览确认</span><span class="modal-close">&times;</span></div>
    <div class="modal-body">
      <h3 style="font-size:13px;color:#2A5A8C;margin-bottom:8px;">数据预览</h3>
      ${previewHtml}
      <h3 style="font-size:13px;color:#2A5A8C;margin-bottom:8px;">字段映射</h3>
      ${mapHtml}
      <h3 style="font-size:13px;color:#2A5A8C;margin:16px 0 8px;">导入方式</h3>
      <div style="margin-bottom:8px;">
        <label style="display:inline-flex;align-items:center;gap:4px;margin-right:20px;cursor:pointer;">
          <input type="radio" name="importMode" value="append" checked> 直接导入
        </label>
        <label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;">
          <input type="radio" name="importMode" value="replace"> 替换数据
        </label>
      </div>
      <div id="replaceMatchFields" style="display:none;margin-bottom:12px;padding:10px;background:#FFF8F0;border-radius:6px;border:1px solid #F0E8D0;">
        <p style="font-size:12px;color:#C6791A;margin-bottom:8px;">选择匹配字段（同时满足所有选中字段的记录将被更新，未匹配则新增）：</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;" id="matchFieldsCheckboxes"></div>
      </div>
      ${data.image_rows&&Object.keys(data.image_rows).length>0?`<p style="margin-top:8px;font-size:12px;color:#3A7D5C;">检测到 Excel 中嵌有图片，将自动导入对应行的病历照片</p>`:''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline btn-sm modal-close-btn">取消</button>
      <button class="btn btn-primary btn-sm" id="importExecBtn">确认导入 ${data.count} 条</button>
    </div></div>`;
  document.body.appendChild(overlay);

  // ★ 按钮点击处理——必须最先绑定，避免被后续异常影响
  const execBtn=overlay.querySelector('#importExecBtn');
  execBtn.onclick=async function(){
    if(execBtn.disabled) return;
    execBtn.disabled=true;
    execBtn.textContent='导入中...';
    try {
      const mapping={};
      overlay.querySelectorAll('[data-map]').forEach(s=>{ const v=s.value; if(v!=='')mapping[s.dataset.map]=parseInt(v); });
      const modeEl=overlay.querySelector('input[name="importMode"]:checked');
      const mode=modeEl?modeEl.value:'append';
      const matchFields=[];
      if(mode==='replace'){
        overlay.querySelectorAll('#matchFieldsCheckboxes input[type="checkbox"]:checked').forEach(cb=>{
          matchFields.push(cb.value);
        });
      }
      const result=await API.post('/api/import/execute',{
        village_id:curVid, mapping, rows:data.rows,
        temp_file:data.temp_file, image_rows:data.image_rows||{},
        mode, match_fields:matchFields
      });
      overlay.remove();
      let msg=`成功导入 ${result.imported} 条病人记录`;
      if(result.updated!==undefined) msg+=`（其中更新 ${result.updated} 条，新增 ${result.inserted} 条）`;
      alert(msg);
      await loadPatients();
    } catch(e) {
      execBtn.disabled=false;
      execBtn.textContent='确认导入 '+(data.count||0)+' 条';
      alert('导入失败：' + (e.message||e));
    }
  };

  function closeImportOverlay(){
    overlay.remove();
  }
  overlay.querySelector('.modal-close').onclick=closeImportOverlay;
  overlay.querySelector('.modal-close-btn').onclick=closeImportOverlay;
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeImportOverlay();});
  // 导入方式切换
  const replaceFieldsDiv=overlay.querySelector('#replaceMatchFields');
  overlay.querySelectorAll('input[name="importMode"]').forEach(radio=>{
    radio.addEventListener('change',function(){
      if(this.value==='replace'){
        replaceFieldsDiv.style.display='block';
        if(window._updateMatchFields) window._updateMatchFields();
      } else {
        replaceFieldsDiv.style.display='none';
      }
    });
  });
  bindImportFieldEvents(overlay, buildMapHtml, updateMatchFields);
  // 添加新字段
  overlay.querySelector('#importAddFieldBtn').addEventListener('click',async()=>{
    const name=overlay.querySelector('#importNewField').value.trim();
    if(!name)return;
    const section=overlay.querySelector('#importNewSection').value;
    const r=await API.post('/api/custom-fields',{name,section});
    const newKey='custom_'+r.id;
    window._importFields.push({key:newKey,label:name});
    // 自动匹配
    for(let i=0;i<data.headers.length;i++){
      const h=data.headers[i].replace(/\s+/g,'');
      if(h===name.replace(/\s+/g,'')||h.includes(name.replace(/\s+/g,''))){ autoMatch[newKey]=i; break; }
    }
    overlay.querySelector('#importNewField').value='';
    const area=overlay.querySelector('#importMappingArea');
    area.innerHTML=buildMapHtml();
    bindImportFieldEvents(overlay, buildMapHtml, updateMatchFields);
    updateMatchFields();
  });
}

// ====== 病情标签管理 ======
document.getElementById('manageTagsBtn').addEventListener('click',showTagManager);

async function showTagManager(){
  const conditions=await API.get('/api/conditions');
  const pallete=[{bg:'#FFE8E0',text:'#C0392B'},{bg:'#FFF0E0',text:'#C6791A'},{bg:'#E0F0E8',text:'#3A7D5C'},{bg:'#FFE8E8',text:'#D35400'},{bg:'#E8E8F0',text:'#5B6C7A'},{bg:'#E8F0FF',text:'#2A5A8C'},{bg:'#FFF8E0',text:'#8B7A2A'},{bg:'#F0E8FF',text:'#6B4A8C'},{bg:'#E8FFF0',text:'#2A6B4A'},{bg:'#FFE8F0',text:'#C0396B'}];
  let listHtml='';
  for(const c of conditions){
    let co; try{co=JSON.parse(c.color);}catch(e){co={bg:'#EEE',text:'#666'};}
    listHtml+=`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F0F2F5;"><span class="tag" style="background:${co.bg};color:${co.text};">${esc(c.name)}</span>${c.is_default?'<span style="font-size:11px;color:#A0BBD0;">系统默认</span>':'<button class="btn-text" style="color:#E74C3C;" data-dt="'+c.id+'">删除</button>'}</div>`;
  }
  const overlay=document.createElement('div'); overlay.className='modal-overlay';
  overlay.innerHTML=`<div class="modal" style="width:440px;"><div class="modal-header"><span>管理病情标签</span><span class="modal-close">&times;</span></div><div class="modal-body"><div style="display:flex;gap:8px;margin-bottom:16px;"><input class="input" id="newTagName" placeholder="新标签名称" style="flex:1;"><button class="btn btn-primary btn-sm" id="addTagBtn">添加</button></div><div id="tagList">${listHtml}</div></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').onclick=()=>overlay.remove();
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  overlay.querySelector('#addTagBtn').addEventListener('click',async()=>{
    const name=overlay.querySelector('#newTagName').value.trim(); if(!name)return;
    if(conditions.find(c=>c.name===name)){ alert('已存在'); return; }
    const idx=conditions.filter(c=>!c.is_default).length;
    await API.post('/api/conditions',{name,color:JSON.stringify(pallete[(5+idx)%pallete.length])});
    overlay.remove(); showTagManager();
  });
  overlay.querySelector('#newTagName').addEventListener('keydown',e=>{if(e.key==='Enter')overlay.querySelector('#addTagBtn').click();});
  overlay.querySelectorAll('[data-dt]').forEach(b=>{ b.addEventListener('click',async()=>{ if(!confirm('确定删除？'))return; await API.del('/api/conditions/'+b.dataset.dt); overlay.remove(); showTagManager(); }); });
}

// ====== 自定义字段管理 ======
document.getElementById('manageFieldsBtn').addEventListener('click',showFieldManager);

async function showFieldManager(){
  const fields=await API.get('/api/custom-fields');
  const secLabel={basic:'基本信息',visit:'看病记录',extra:'附加信息'};
  let list='';
  for(const f of fields){ list+=`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F0F2F5;"><span style="flex:1;cursor:pointer;" data-edit="${f.id}" title="点击改名">${esc(f.name)} <span style="font-size:10px;color:#A0BBD0;">[${secLabel[f.section]||'附加信息'}]</span></span><button class="btn-text" style="color:#E74C3C;" data-df="${f.id}">删除</button></div>`; }
  if(!fields.length) list='<p style="color:#A0BBD0;font-size:13px;">暂无自定义字段</p>';
  const overlay=document.createElement('div'); overlay.className='modal-overlay';
  overlay.innerHTML=`<div class="modal" style="width:440px;"><div class="modal-header"><span>管理自定义字段</span><span class="modal-close">&times;</span></div><div class="modal-body">
    <div style="display:flex;gap:4px;margin-bottom:8px;">
      <input class="input" id="newFieldName" placeholder="字段名(如：血压)" style="flex:1;font-size:12px;">
      <select class="select" id="newFieldSection" style="width:100px;font-size:12px;"><option value="basic">基本信息</option><option value="visit">看病记录</option><option value="extra">附加信息</option></select>
      <button class="btn btn-primary btn-sm" id="addFieldBtn">添加</button>
    </div>
    <div id="fieldList">${list}</div></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').onclick=()=>overlay.remove();
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  overlay.querySelector('#addFieldBtn').addEventListener('click',async()=>{
    const name=overlay.querySelector('#newFieldName').value.trim();
    const section=overlay.querySelector('#newFieldSection').value;
    if(!name)return;
    await API.post('/api/custom-fields',{name,section}); overlay.remove(); showFieldManager();
  });
  overlay.querySelectorAll('[data-df]').forEach(b=>{ b.addEventListener('click',async()=>{ if(!confirm('确定删除？'))return; await API.del('/api/custom-fields/'+b.dataset.df); overlay.remove(); showFieldManager(); }); });
  // 改名
  overlay.querySelectorAll('[data-edit]').forEach(el=>{ el.addEventListener('click',async()=>{
    const fid=parseInt(el.dataset.edit);
    const field=fields.find(f=>f.id===fid);
    const newName=prompt('修改字段名：',field?field.name:'');
    if(!newName||!newName.trim())return;
    await API.put('/api/custom-fields/'+fid,{name:newName.trim()});
    overlay.remove(); showFieldManager();
  }); });
}

// ==============================
// 详情页
// ==============================
async function loadDetail(pid){
  const patient=await API.get('/api/patients/'+pid);
  if(!patient||patient.error){ alert('未找到'); window.location.hash='main'; return; }
  document.getElementById('detailHeaderName').textContent=patient.name+' - 病历详情';
  const conditions=await API.get('/api/conditions'); let co={bg:'#EEE',text:'#666'};
  for(const c of conditions){ if(c.name===patient.condition){ try{co=JSON.parse(c.color);}catch(e){} break; } }

  // 自定义字段值
  const fieldValues=patient.custom_fields||[];
  let customHtml='';
  for(const fv of fieldValues){ customHtml+=`<div class="info-row"><span class="info-label">${esc(fv.name)}：</span><span class="info-value">${esc(fv.value)||'-'}</span></div>`; }

  document.getElementById('infoCard').innerHTML=`<h3>基本信息</h3><div class="info-row"><span class="info-label">姓名：</span><span class="info-value">${esc(patient.name)}</span></div><div class="info-row"><span class="info-label">性别：</span><span class="info-value">${patient.gender||'-'}</span></div><div class="info-row"><span class="info-label">年龄：</span><span class="info-value">${patient.age||'-'} 岁</span></div><div class="info-row"><span class="info-label">电话：</span><span class="info-value">${esc(patient.phone)||'-'}</span></div><div class="info-row"><span class="info-label">住址：</span><span class="info-value">${esc(patient.address)||'-'}</span></div>${customHtml}`;
  let remarkHtml='';
  if(patient.remark) remarkHtml=`<div class="info-row"><span class="info-label">备注：</span><span class="info-value" style="white-space:pre-wrap;">${esc(patient.remark)}</span></div>`;
  document.getElementById('visitCard').innerHTML=`<h3>看病记录</h3><div class="info-row"><span class="info-label">日期：</span><span class="info-value">${patient.visit_date||'-'}</span></div><div class="info-row"><span class="info-label">病情：</span><span class="info-value"><span class="tag" style="background:${co.bg};color:${co.text}">${esc(patient.condition)||'-'}</span></span></div>${remarkHtml}`;

  const photos=await API.get('/api/photos/'+pid);
  const grid=document.getElementById('detailPhotoGrid');
  if(!photos.length){ grid.innerHTML='<div class="no-photos">暂无病历照片</div>'; }
  else {
    grid.innerHTML='';
    for(const p of photos){
      const div=document.createElement('div'); div.className='detail-photo-item';
      div.innerHTML=`<img src="/api/photos/file/${encodeURIComponent(p.filename)}" onerror="this.parentElement.innerHTML='<div class=no-photos>加载失败</div>'">`;
      div.onclick=()=>{ document.getElementById('viewerImage').src='/api/photos/file/'+encodeURIComponent(p.filename); document.getElementById('imageViewer').style.display='flex'; };
      grid.appendChild(div);
    }
  }
  document.getElementById('editFromDetail').onclick=()=>{ window.location.hash='form/'+pid; };
}
document.getElementById('imageViewer').addEventListener('click',function(){this.style.display='none';});

// ==============================
// 表单页
// ==============================
let fmEdit=false, fmPid=null, fmVid=null, fmPending=[], fmExist=[], fmDel=[], fmFields=[];

async function initForm(pid,vid){
  fmPid=pid; fmVid=vid; fmPending=[]; fmExist=[]; fmDel=[];
  document.getElementById('formName').value=''; document.getElementById('formGender').value='男';
  document.getElementById('formAge').value=''; document.getElementById('formPhone').value='';
  document.getElementById('formAddress').value=''; document.getElementById('formVisitDate').value=new Date().toISOString().split('T')[0];
  document.getElementById('formError').style.display='none';

  const conditions=await API.get('/api/conditions');
  const sel=document.getElementById('formCondition'); sel.innerHTML='';
  for(const c of conditions){ const o=document.createElement('option'); o.value=c.name; o.textContent=c.name; sel.appendChild(o); }

  // 加载自定义字段
  fmFields=await API.get('/api/custom-fields');
  renderCustomFields();

  if(pid){
    fmEdit=true; document.getElementById('formHeaderTitle').textContent='编辑病人';
    const p=await API.get('/api/patients/'+pid);
    if(!p||p.error){ alert('未找到'); window.location.hash='main'; return; }
    fmVid=p.village_id;
    document.getElementById('formName').value=p.name; document.getElementById('formGender').value=p.gender||'男';
    document.getElementById('formAge').value=p.age||''; document.getElementById('formPhone').value=p.phone||'';
    document.getElementById('formAddress').value=p.address||''; document.getElementById('formVisitDate').value=p.visit_date||'';
    document.getElementById('formCondition').value=p.condition||'';
    document.getElementById('formRemark').value=p.remark||'';
    toggleRemark();
    // 加载已有字段值
    const vals=p.custom_fields||[];
    for(const v of vals){
      const inp=document.getElementById('custom_'+v.field_id);
      if(inp)inp.value=v.value||'';
    }
    fmExist=await API.get('/api/photos/'+pid);
  } else { fmEdit=false; document.getElementById('formHeaderTitle').textContent='添加病人'; document.getElementById('formRemark').value=''; }
  toggleRemark();
  renderFormPhotos(); setupFormUpload();
}

function toggleRemark(){
  const cond=document.getElementById('formCondition').value;
  document.getElementById('remarkGroup').style.display=cond?'block':'none';
}

// 监听病情选择变化
document.getElementById('formCondition').addEventListener('change',toggleRemark);

function renderCustomFields(){
  const container=document.getElementById('customFieldsContainer');
  const section=document.getElementById('customFieldsSection');
  const basicEl=document.getElementById('customFieldsBasic');
  const visitEl=document.getElementById('customFieldsVisit');
  const extraFields=fmFields.filter(f=>f.section==='extra'||!f.section);
  const basicFields=fmFields.filter(f=>f.section==='basic');
  const visitFields=fmFields.filter(f=>f.section==='visit');

  // 基本信息区
  if(basicEl){
    let h='';
    for(const f of basicFields) h+=`<div class="form-group"><label>${esc(f.name)}</label><input class="input" type="text" id="custom_${f.id}" style="width:100%;"></div>`;
    basicEl.innerHTML=h; basicEl.style.display=h?'block':'none';
  }
  // 看病记录区
  if(visitEl){
    let h='';
    for(const f of visitFields) h+=`<div class="form-group"><label>${esc(f.name)}</label><input class="input" type="text" id="custom_${f.id}" style="width:100%;"></div>`;
    visitEl.innerHTML=h; visitEl.style.display=h?'block':'none';
  }
  // 附加信息区
  let html='';
  for(const f of extraFields) html+=`<div class="form-group"><label>${esc(f.name)}</label><input class="input" type="text" id="custom_${f.id}" style="width:100%;"></div>`;
  container.innerHTML=html;
  section.style.display=(basicFields.length||visitFields.length||extraFields.length)?'block':'none';
}

function setupFormUpload(){
  const ua=document.getElementById('uploadArea'), na=ua.cloneNode(true);
  ua.parentNode.replaceChild(na,ua);
  na.addEventListener('click',()=>{
    const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.multiple=true;
    inp.onchange=()=>{ for(const f of inp.files)fmPending.push(f); renderFormPhotos(); };
    inp.click();
  });
  na.addEventListener('dragover',e=>{e.preventDefault();na.classList.add('drag-over');});
  na.addEventListener('dragleave',()=>na.classList.remove('drag-over'));
  na.addEventListener('drop',e=>{ e.preventDefault(); na.classList.remove('drag-over'); for(const f of e.dataTransfer.files)fmPending.push(f); renderFormPhotos(); });
}

function renderFormPhotos(){
  const grid=document.getElementById('formPhotoGrid'); let html='';
  for(const p of fmExist){ if(fmDel.includes(p.id))continue;
    html+=`<div class="photo-thumb-card"><img src="/api/photos/file/${encodeURIComponent(p.filename)}" onerror="this.parentElement.innerHTML='<div style=width:110px;height:130px;display:flex;align-items:center;justify-content:center;background:#E8F0F8;border-radius:6px;font-size:11px;color:#888;>加载失败</div>'"><button class="remove-btn" data-rm="exist" data-id="${p.id}">&#x2715;</button></div>`; }
  for(let i=0;i<fmPending.length;i++){
    html+=`<div class="photo-thumb-card"><img src="${URL.createObjectURL(fmPending[i])}" onerror="this.style.display='none'"><button class="remove-btn" data-rm="pend" data-idx="${i}">&#x2715;</button></div>`;
  }
  grid.innerHTML=html;
  grid.querySelectorAll('.remove-btn').forEach(b=>{ b.addEventListener('click',e=>{ e.stopPropagation();
    if(b.dataset.rm==='exist')fmDel.push(Number(b.dataset.id)); else fmPending.splice(Number(b.dataset.idx),1);
    renderFormPhotos(); }); });
}

document.getElementById('formSaveBtn').addEventListener('click',async()=>{
  const name=document.getElementById('formName').value.trim(), errEl=document.getElementById('formError');
  if(!name){ errEl.textContent='请输入病人姓名'; errEl.style.display='block'; return; }
  if(!fmVid){ errEl.textContent='请先选择村庄后再添加病人'; errEl.style.display='block'; return; }
  const remarkEl=document.getElementById('formRemark');
  const data={ village_id:fmVid, name, gender:document.getElementById('formGender').value,
    age:parseInt(document.getElementById('formAge').value)||0, phone:document.getElementById('formPhone').value.trim(),
    address:document.getElementById('formAddress').value.trim(), visit_date:document.getElementById('formVisitDate').value,
    condition:document.getElementById('formCondition').value, remark:remarkEl?remarkEl.value.trim():'' };
  try{
    if(fmEdit){ await API.put('/api/patients/'+fmPid,data); for(const pid of fmDel)await API.del('/api/photos/delete/'+pid); }
    else { const r=await API.post('/api/patients',data); fmPid=r.id; fmEdit=true; }
    // 保存自定义字段
    const fieldValues=[];
    for(const f of fmFields){
      const inp=document.getElementById('custom_'+f.id);
      if(inp)fieldValues.push({field_id:f.id,value:inp.value.trim()});
    }
    if(fieldValues.length) await API.put('/api/patients/'+fmPid+'/fields',{values:fieldValues});
    // 上传照片
    for(const f of fmPending){ const fd=new FormData(); fd.append('file',f); await API.upload('/api/photos/'+fmPid,fd); }
    window.location.hash='main';
  }catch(err){ errEl.textContent='保存失败：'+err.message; errEl.style.display='block'; }
});
