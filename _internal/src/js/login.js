const passwordInput = document.getElementById('passwordInput');
const newPasswordInput = document.getElementById('newPasswordInput');
const confirmPasswordInput = document.getElementById('confirmPasswordInput');
const errorMsg = document.getElementById('errorMsg');
const loginBtn = document.getElementById('loginBtn');
const changePwdLink = document.getElementById('changePwdLink');
const changePwdRow = document.getElementById('changePwdRow');

let isChangingPwd = false;

changePwdLink.addEventListener('click', () => {
  isChangingPwd = !isChangingPwd;
  changePwdRow.classList.toggle('show', isChangingPwd);
  changePwdLink.textContent = isChangingPwd ? '取消修改' : '修改密码';
  errorMsg.textContent = '';
  if (isChangingPwd) {
    loginBtn.textContent = '保存并登录';
    newPasswordInput.focus();
  } else {
    loginBtn.textContent = '登 录';
    passwordInput.focus();
    newPasswordInput.value = '';
    confirmPasswordInput.value = '';
  }
});

passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});

newPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') confirmPasswordInput.focus();
});

confirmPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});

loginBtn.addEventListener('click', doLogin);

async function doLogin() {
  errorMsg.textContent = '';

  if (isChangingPwd) {
    const oldPwd = passwordInput.value.trim();
    const newPwd = newPasswordInput.value.trim();
    const confirmPwd = confirmPasswordInput.value.trim();

    if (!oldPwd) { errorMsg.textContent = '请输入当前密码'; return; }
    if (!newPwd) { errorMsg.textContent = '请输入新密码'; return; }
    if (newPwd.length < 4) { errorMsg.textContent = '新密码至少4位'; return; }
    if (newPwd !== confirmPwd) { errorMsg.textContent = '两次输入的新密码不一致'; return; }

    const storedPwd = await window.api.getSetting('password');
    if (oldPwd !== storedPwd) {
      errorMsg.textContent = '当前密码不正确'; return;
    }
    await window.api.updateSetting('password', newPwd);
  } else {
    const pwd = passwordInput.value.trim();
    if (!pwd) { errorMsg.textContent = '请输入密码'; return; }

    const storedPwd = await window.api.getSetting('password');
    if (pwd !== storedPwd) {
      errorMsg.textContent = '密码不正确'; return;
    }
  }

  window.location.hash = 'main';
}
