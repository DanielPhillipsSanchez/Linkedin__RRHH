document.getElementById('settings-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});
