let patientId = null;

async function loadDetail() {
  const hash = window.location.hash;
  const parts = hash.split('/');
  patientId = Number(parts[1]);

  const patient = await window.api.getPatientById(patientId);
  if (!patient) {
    alert('未找到该病人');
    window.location.hash = 'main';
    return;
  }

  document.getElementById('headerName').textContent = patient.name + ' - 病历详情';

  // 病情颜色
  const conditions = await window.api.getConditions();
  let colorObj = { bg: '#EEE', text: '#666' };
  for (const c of conditions) {
    if (c.name === patient.condition) {
      try { colorObj = JSON.parse(c.color); } catch (e) {}
      break;
    }
  }

  // 基本信息
  document.getElementById('infoCard').innerHTML = `
    <h3>基本信息</h3>
    <div class="info-row"><span class="info-label">姓名：</span><span class="info-value">${esc(patient.name)}</span></div>
    <div class="info-row"><span class="info-label">性别：</span><span class="info-value">${patient.gender || '-'}</span></div>
    <div class="info-row"><span class="info-label">年龄：</span><span class="info-value">${patient.age || '-'} 岁</span></div>
    <div class="info-row"><span class="info-label">电话：</span><span class="info-value">${esc(patient.phone) || '-'}</span></div>
    <div class="info-row"><span class="info-label">住址：</span><span class="info-value">${esc(patient.address) || '-'}</span></div>
  `;

  // 看病记录
  document.getElementById('visitCard').innerHTML = `
    <h3>本次看病记录</h3>
    <div class="info-row"><span class="info-label">看病日期：</span><span class="info-value">${patient.visit_date || '-'}</span></div>
    <div class="info-row"><span class="info-label">病情类型：</span><span class="info-value"><span class="tag" style="background:${colorObj.bg};color:${colorObj.text}">${esc(patient.condition) || '-'}</span></span></div>
  `;

  // 照片
  const photos = await window.api.getPhotos(patientId);
  const photoGrid = document.getElementById('photoGrid');
  if (photos.length === 0) {
    photoGrid.innerHTML = '<div class="no-photos">暂无病历照片</div>';
  } else {
    photoGrid.innerHTML = photos.map(p => `
      <div class="photo-item" onclick="viewPhoto('${esc(p.filename)}')">
        <img src="file://${encodeURI(photoPathFor(p.filename))}" onerror="this.parentElement.innerHTML='<div class=\\'no-photos\\' style=\\'padding:20px;\\'>加载失败</div>'">
      </div>
    `).join('');
    window._photoMap = {};
    for (const p of photos) {
      window._photoMap[p.filename] = p;
    }
  }

  // 编辑按钮
  document.getElementById('editBtn').addEventListener('click', () => {
    window.location.hash = `form/${patientId}`;
  });
}

async function photoPathFor(filename) {
  return await window.api.getPhotoPath(filename);
}

async function viewPhoto(filename) {
  const filepath = await window.api.getPhotoPath(filename);
  document.getElementById('viewerImage').src = 'file://' + encodeURI(filepath);
  document.getElementById('imageViewer').style.display = 'flex';
}

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

loadDetail();
