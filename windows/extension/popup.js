const nativeFeatures = [
  'Edge-to-edge web content',
  'Square corners by the sidebar',
  'Hide toolbar',
  'Reveal toolbar on hover',
  'Hide sidebar button',
  'Hide Chat button',
  'Hide Chats button',
  'Hide recent tabs button'
];
const list = document.getElementById('native-features');
for (const title of nativeFeatures) {
  const label = document.createElement('label');
  label.className = 'feature';
  const text = document.createElement('span');
  const heading = document.createElement('strong');
  heading.textContent = title;
  const note = document.createElement('small');
  note.textContent = 'Unavailable in Windows prototype';
  text.append(heading, note);
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.disabled = true;
  box.setAttribute('aria-label', `${title}, not yet supported`);
  label.append(text, box);
  list.append(label);
}
const toggle = document.getElementById('auto');
const button = document.getElementById('group-now');
const status = document.getElementById('status');
function show(message, error = false) {
  status.textContent = message;
  status.className = error ? 'error' : '';
}
chrome.storage.local.get({ autoGroupByDomain: false }).then(settings => {
  toggle.checked = Boolean(settings.autoGroupByDomain);
}).catch(e => show(e.message, true));
toggle.addEventListener('change', async () => {
  try {
    await chrome.storage.local.set({ autoGroupByDomain: toggle.checked });
    show(toggle.checked ? 'Automatic grouping enabled.' : 'Automatic grouping disabled.');
  } catch (e) {
    toggle.checked = !toggle.checked;
    show(String(e.message || e), true);
  }
});
button.addEventListener('click', async () => {
  button.disabled = true;
  show('Grouping open tabs…');
  try {
    const result = await chrome.runtime.sendMessage({ type: 'GROUP_NOW' });
    if (!result?.ok) throw new Error(result?.error || 'No response from background worker');
    show(`Grouped ${result.groupedTabs} tab(s); created ${result.createdGroups} group(s).`);
  } catch (e) {
    show(String(e.message || e), true);
  } finally {
    button.disabled = false;
  }
});
