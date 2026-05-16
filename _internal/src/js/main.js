let currentVillageId = null;
let currentVillageName = '';

// ====== 村庄列表 ======
async function loadVillages() {
  const search = document.getElementById('villageSearch').value.trim();
  const villages = await window.api.getVillages(search);
  const listEl = document.getElementById('villageList');
  listEl.innerHTML = '';

  if (villages.length === 0) {
    listEl.innerHTML = '<div class="empty-state" style="padding:24px;"><p style="font-size:13px;">暂无村庄</p></div>';
    return;
  }

  for (const v of villages) {
    const div = document.createElement('div');
    div.className = 'village-item' + (v.id === currentVillageId ? ' active' : '');
    div.innerHTML = `<span>${escapeHtml(v.name)}</span>`;
    div.onclick = () => selectVillage(v.id, v.name);
    listEl.appendChild(div);
  }
}

async function selectVillage(id, name) {
  currentVillageId = id;
  currentVillageName = name;
  document.getElementById('titleArea').innerHTML = `${escapeHtml(name)} <span class="patient-count" id="patientCount"></span>`;
  document.getElementById('filterName').value = '';
  document.getElementById('filterAge').value = '';
  document.getElementById('filterPhone').value = '';
  document.getElementById('filterAddress').value = '';
  document.getElementById('filterDate').value = '';
  await loadVillages();
  await loadPatients();
}

document.getElementById('addVillageBtn').addEventListener('click', async () => {
  const name = prompt('请输入村庄名称：');
  if (!name || !name.trim()) return;
  await window.api.addVillage(name.trim());
  await loadVillages();
});

document.getElementById('villageSearch').addEventListener('input', debounce(loadVillages, 300));

// ====== 病人列表 ======
async function loadPatients() {
  if (!currentVillageId) return;

  const filters = {
    name: document.getElementById('filterName').value.trim(),
    age: document.getElementById('filterAge').value.trim(),
    phone: document.getElementById('filterPhone').value.trim(),
    address: document.getElementById('filterAddress').value.trim(),
    date: document.getElementById('filterDate').value
  };

  const patients = await window.api.getPatients(currentVillageId, filters);
  const container = document.getElementById('tableContainer');

  if (patients.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">&#x1f4cb;</div><p>暂无病人记录</p></div>';
  } else {
    renderTable(patients);
  }

  document.getElementById('patientCount').textContent = `共 ${patients.length} 人`;
}

async function renderTable(patients) {
  const conditions = await window.api.getConditions();
  const colorMap = {};
  for (const c of conditions) {
    try { colorMap[c.name] = JSON.parse(c.color); } catch (e) { colorMap[c.name] = { bg: '#EEE', text: '#666' }; }
  }

  let html = '<div class="table-wrapper"><table><thead><tr>';
  const headers = ['姓名', '性别', '年龄', '电话', '住址', '看病日期', '病情', '操作'];
  for (const h of headers) {
    html += `<th>${h}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const p of patients) {
    const colors = colorMap[p.condition] || { bg: '#EEE', text: '#666' };
    html += `<tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${p.gender || '-'}</td>
      <td>${p.age || '-'}</td>
      <td>${escapeHtml(p.phone) || '-'}</td>
      <td>${escapeHtml(p.address) || '-'}</td>
      <td>${p.visit_date || '-'}</td>
      <td><span class="tag" style="background:${colors.bg};color:${colors.text}">${escapeHtml(p.condition) || '-'}</span></td>
      <td class="ops-cell">
        <button class="btn-text" data-action="view" data-id="${p.id}">查看</button>
        <button class="btn-text" data-action="edit" data-id="${p.id}">编辑</button>
        <button class="btn-text" data-action="delete" data-id="${p.id}" style="color:#E74C3C;">删除</button>
      </td>
    </tr>`;
  }
  html += '</tbody></table></div>';

  document.getElementById('tableContainer').innerHTML = html;

  // 绑定表格操作按钮
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = Number(btn.dataset.id);
      if (action === 'view') {
        window.location.hash = `detail/${id}`;
      } else if (action === 'edit') {
        window.location.hash = `form/${id}`;
      } else if (action === 'delete') {
        if (confirm('确定要删除该病人吗？此操作不可恢复。')) {
          await window.api.deletePatient(id);
          await loadPatients();
        }
      }
    });
  });
}

// ====== 筛选 ======
document.getElementById('searchBtn').addEventListener('click', loadPatients);
document.getElementById('resetBtn').addEventListener('click', () => {
  document.getElementById('filterName').value = '';
  document.getElementById('filterAge').value = '';
  document.getElementById('filterPhone').value = '';
  document.getElementById('filterAddress').value = '';
  document.getElementById('filterDate').value = '';
  loadPatients();
});

// 回车键触发筛选
['filterName', 'filterAge', 'filterPhone', 'filterAddress', 'filterDate'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadPatients();
  });
});

// ====== 添加病人 ======
document.getElementById('addPatientBtn').addEventListener('click', () => {
  if (!currentVillageId) { alert('请先选择左侧村庄'); return; }
  window.location.hash = `form/new/${currentVillageId}`;
});

// ====== 导出 Excel ======
document.getElementById('exportBtn').addEventListener('click', async () => {
  if (!currentVillageId) { alert('请先选择村庄'); return; }
  const patients = await window.api.getPatients(currentVillageId, {});
  if (patients.length === 0) { alert('当前村庄没有病人数据'); return; }

  const result = await window.api.exportExcel(currentVillageName, patients);
  if (result.success) {
    alert('导出成功！');
  } else if (!result.canceled) {
    alert('导出失败，请重试。');
  }
});

// ====== 病情标签管理 ======
document.getElementById('manageTagsBtn').addEventListener('click', showTagManager);

async function showTagManager() {
  const conditions = await window.api.getConditions();

  let listHtml = '';
  const pallete = [
    { bg: '#FFE8E0', text: '#C0392B' },
    { bg: '#FFF0E0', text: '#C6791A' },
    { bg: '#E0F0E8', text: '#3A7D5C' },
    { bg: '#FFE8E8', text: '#D35400' },
    { bg: '#E8E8F0', text: '#5B6C7A' },
    { bg: '#E8F0FF', text: '#2A5A8C' },
    { bg: '#FFF8E0', text: '#8B7A2A' },
    { bg: '#F0E8FF', text: '#6B4A8C' },
    { bg: '#E8FFF0', text: '#2A6B4A' },
    { bg: '#FFE8F0', text: '#C0396B' }
  ];

  for (const c of conditions) {
    let colorObj;
    try { colorObj = JSON.parse(c.color); } catch (e) { colorObj = { bg: '#EEE', text: '#666' }; }
    listHtml += `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F0F2F5;">
      <span class="tag" style="background:${colorObj.bg};color:${colorObj.text};">${escapeHtml(c.name)}</span>
      ${c.is_default ? '<span style="font-size:11px;color:#A0BBD0;">系统默认</span>' : `<button class="btn-text" style="color:#E74C3C;" onclick="deleteTagConfirm(${c.id}, '${escapeHtml(c.name)}')">删除</button>`}
    </div>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="width:440px;">
      <div class="modal-header">
        <span>管理病情标签</span>
        <span class="modal-close" onclick="this.closest('.modal-overlay').remove()">&#x2715;</span>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:8px;margin-bottom:16px;">
          <input class="input" id="newTagName" placeholder="输入新标签名称" style="flex:1;">
          <button class="btn btn-primary btn-sm" id="addTagBtn">添加</button>
        </div>
        <div id="tagList">${listHtml}</div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#addTagBtn').addEventListener('click', async () => {
    const input = overlay.querySelector('#newTagName');
    const name = input.value.trim();
    if (!name) return;

    const exists = conditions.find(c => c.name === name);
    if (exists) { alert('该标签已存在'); return; }

    const idx = conditions.filter(c => !c.is_default).length;
    const color = pallete[(5 + idx) % pallete.length];
    await window.api.addCondition(name, JSON.stringify(color));
    input.value = '';
    overlay.remove();
    showTagManager();
  });

  // 支持回车添加
  overlay.querySelector('#newTagName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') overlay.querySelector('#addTagBtn').click();
  });

  window.deleteTagConfirm = async (id, name) => {
    if (!confirm(`确定要删除标签「${name}」吗？`)) return;
    await window.api.deleteCondition(id);
    overlay.remove();
    showTagManager();
  };
}

// ====== 工具函数 ======
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ====== 初始加载 ======
loadVillages();
