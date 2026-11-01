/** Pure grouping planner. No browser APIs, page content, or network requests. */
export function normalizedHost(rawUrl) {
  if (typeof rawUrl !== 'string') return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Plans additions without modifying pinned tabs or user-defined mixed-domain groups.
 * Only an existing group whose title equals its single domain can be reused.
 * Each group action is {host, tabIds, groupId?}.
 */
export function planGroups(tabs, groups) {
  const byId = new Map(groups.map(g => [g.id, g]));
  const members = new Map();
  for (const tab of tabs) {
    if (tab.groupId !== -1 && Number.isInteger(tab.groupId)) {
      if (!members.has(tab.groupId)) members.set(tab.groupId, []);
      members.get(tab.groupId).push(tab);
    }
  }
  const existing = new Map();
  for (const [id, list] of members) {
    const group = byId.get(id);
    if (!group || typeof group.title !== 'string') continue;
    const domains = new Set(list.map(tab => normalizedHost(tab.url)));
    if (domains.size !== 1) continue;
    const host = [...domains][0];
    if (host && group.title === host && !existing.has(host)) existing.set(host, id);
  }

  const ungrouped = new Map();
  for (const tab of tabs) {
    if (tab.pinned || tab.groupId !== -1) continue;
    const host = normalizedHost(tab.url);
    if (!host || !Number.isInteger(tab.id)) continue;
    if (!ungrouped.has(host)) ungrouped.set(host, []);
    ungrouped.get(host).push(tab.id);
  }
  const plan = [];
  for (const [host, tabIds] of ungrouped) {
    if (existing.has(host)) plan.push({ host, tabIds, groupId: existing.get(host) });
    else if (tabIds.length >= 2) plan.push({ host, tabIds });
  }
  return plan;
}
