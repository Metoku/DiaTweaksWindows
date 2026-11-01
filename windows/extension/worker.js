import { planGroups } from './grouping.mjs';

const inFlight = new Map();

async function groupWindow(windowId) {
  if (!chrome.tabGroups?.query || !chrome.tabs?.group) {
    throw new Error('Dia did not expose the Chromium tabGroups API in this build.');
  }
  const tabs = await chrome.tabs.query({ windowId });
  const groups = await chrome.tabGroups.query({ windowId });
  const plan = planGroups(tabs, groups);
  let groupedTabs = 0;
  let createdGroups = 0;
  for (const item of plan) {
    const args = { tabIds: item.tabIds };
    if (Number.isInteger(item.groupId)) args.groupId = item.groupId;
    const groupId = await chrome.tabs.group(args);
    if (!Number.isInteger(item.groupId)) {
      await chrome.tabGroups.update(groupId, { title: item.host });
      createdGroups++;
    }
    groupedTabs += item.tabIds.length;
  }
  return { groupedTabs, createdGroups };
}

function queueGrouping(windowId) {
  if (!Number.isInteger(windowId) || windowId < 0) {
    return Promise.reject(new Error('No active browser window found.'));
  }
  const prev = inFlight.get(windowId) || Promise.resolve();
  const task = prev.catch(() => {}).then(() => groupWindow(windowId));
  inFlight.set(windowId, task);
  task.finally(() => {
    if (inFlight.get(windowId) === task) inFlight.delete(windowId);
  }).catch(() => {});
  return task;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'GROUP_NOW') return false;
  (async () => {
    try {
      const active = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
      const result = await queueGrouping(active.id);
      respond({ ok: true, ...result });
    } catch (error) {
      respond({ ok: false, error: String(error?.message || error) });
    }
  })();
  return true;
});

chrome.tabs.onUpdated.addListener((_id, changes, tab) => {
  if (changes.status !== 'complete' || !Number.isInteger(tab.windowId)) return;
  chrome.storage.local.get('autoGroupByDomain').then(settings => {
    if (settings.autoGroupByDomain) return queueGrouping(tab.windowId);
  }).catch(error => console.warn('DiaTweaks automatic grouping:', error));
});
