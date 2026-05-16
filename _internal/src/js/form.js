let editMode = false;
let patientId = null;
let villageId = null;
let pendingPhotos = [];    // { sourcePath, originalName }
let existingPhotos = [];   // { id, filename, original_name }
let deletedPhotoIds = [];

async function init() {
  const hash = window.location.hash;
  const parts = hash.split('/');

  if (parts[1] === 'new') {
    editMode = false;
    villageId = Number(parts[2]);
    document.getElementById('headerTitle').textContent = '添加病人';
  } else {
    editMode = true;
    patientId = Number(parts[1]);
    document.getElementById('headerTitle').textContent = '编辑病人';
  }

  // 加载病情下拉
  const conditions = await window.api.getConditions();
  const select = document.getElementById('condition');
  for (const c of conditions) {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    select.appendChild(opt);
  }

  // 如果是编辑模式，加载病人数据
  if (editMode) {
    await loadPatientData();
  } else {
    document.getElementById('visitDate').value = new Date().toISOString().split('T')[0];
  }

  // 上传区域事件
  setupUpload();
}

async function loadPatientData() {
  const patient = await window.api.getPatientById(patientId);
  if (!patient) { alert('未找到该病人'); window.location.hash = 'main'; return; }

  villageId = patient.village_id;
  document.getElementById('name').value = patient.name;
  document.getElementById('gender').value = patient.gender || '男';
  document.getElementById('age').value = patient.age || '';
  document.getElementById('phone').value = patient.phone || '';
  document.getElementById('address').value = patient.address || '';
  document.getElementById('visitDate').value = patient.visit_date || '';
  document.getElementById('condition').value = patient.condition || '';

  // 加载已有照片
  existingPhotos = await window.api.getPhotos(patientId);
  renderPhotos();
}

function setupUpload() {
  const uploadArea = document.getElementById('uploadArea');

  uploadArea.addEventListener('click', async () => {
    const files = await window.api.selectFiles();
    for (const filePath of files) {
      const name = filePath.split(/[/\\]/).pop();
      pendingPhotos.push({ sourcePath: filePath, originalName: name });
    }
    renderPhotos();
  });

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    for (const file of e.dataTransfer.files) {
      pendingPhotos.push({ sourcePath: file.path, originalName: file.name });
    }
    renderPhotos();
  });
}

function renderPhotos() {
  const grid = document.getElementById('photoGrid');
  let html = '';

  // 已有照片
  for (const p of existingPhotos) {
    if (deletedPhotoIds.includes(p.id)) continue;
    html += `<div class="photo-thumb-card">
      <div style="width:110px;height:130px;display:flex;align-items:center;justify-content:center;background:#E8F0F8;border-radius:6px;font-size:11px;color:#888;">${esc(p.original_name)}</div>
      <button class="remove-btn" data-action="remove-existing" data-id="${p.id}">&#x2715;</button>
    </div>`;
  }

  // 新添加的照片
  for (let i = 0; i < pendingPhotos.length; i++) {
    const p = pendingPhotos[i];
    html += `<div class="photo-thumb-card">
      <img src="file://${encodeURI(p.sourcePath)}" onerror="this.style.display='none'">
      <button class="remove-btn" data-action="remove-pending" data-idx="${i}">&#x2715;</button>
    </div>`;
  }

  grid.innerHTML = html;

  // 绑定删除按钮
  grid.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.dataset.action === 'remove-existing') {
        deletedPhotoIds.push(Number(btn.dataset.id));
      } else {
        pendingPhotos.splice(Number(btn.dataset.idx), 1);
      }
      renderPhotos();
    });
  });
}

// ====== 保存 ======
document.getElementById('saveBtn').addEventListener('click', async () => {
  const name = document.getElementById('name').value.trim();
  const errorEl = document.getElementById('errorMsg');

  if (!name) {
    errorEl.textContent = '请输入病人姓名';
    errorEl.style.display = 'block';
    return;
  }

  const data = {
    village_id: villageId,
    name: name,
    gender: document.getElementById('gender').value,
    age: parseInt(document.getElementById('age').value) || 0,
    phone: document.getElementById('phone').value.trim(),
    address: document.getElementById('address').value.trim(),
    visit_date: document.getElementById('visitDate').value,
    condition: document.getElementById('condition').value
  };

  try {
    if (editMode) {
      await window.api.updatePatient(patientId, data);

      // 删除被标记删除的旧照片
      for (const photoId of deletedPhotoIds) {
        await window.api.deletePhoto(photoId);
      }
    } else {
      const result = await window.api.addPatient(data);
      patientId = result.id;
      editMode = true;
    }

    // 添加新照片
    for (const p of pendingPhotos) {
      await window.api.addPhoto(patientId, p.sourcePath, p.originalName);
    }

    window.location.hash = 'main';
  } catch (err) {
    errorEl.textContent = '保存失败：' + (err.message || '未知错误');
    errorEl.style.display = 'block';
  }
});

document.getElementById('cancelBtn').addEventListener('click', () => {
  window.location.hash = 'main';
});

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

init();
