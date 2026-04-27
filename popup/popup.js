const STORAGE_KEY = "siteConfigV2";
const DEFAULT_CONFIG = { enabled: false };

function normalizeConfig(config) {
  const safe = config && typeof config === "object" ? config : {};
  return { enabled: Boolean(safe.enabled) };
}

async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function getHostnameFromUrl(url) {
  try {
    return new URL(url).hostname || "unknown";
  } catch (_) {
    return "unknown";
  }
}

async function getStoredConfig(hostname) {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const siteConfig = result[STORAGE_KEY] || {};
  return normalizeConfig(siteConfig[hostname] || DEFAULT_CONFIG);
}

function markActive(config) {
  document.getElementById("enabledToggle").checked = config.enabled;
}

async function pushConfig(config) {
  const tab = await getActiveTab();
  if (!tab || !tab.id) return;
  await browser.tabs.sendMessage(tab.id, {
    type: "SMART_RTL_SET_CONFIG",
    config
  });
}

async function saveAndApply(config) {
  await pushConfig(config);
  markActive(config);
}

async function init() {
  const tab = await getActiveTab();
  const host = getHostnameFromUrl(tab.url || "");
  document.getElementById("host").textContent = host;

  const result = await browser.storage.local.get(STORAGE_KEY);
  const siteConfig = result[STORAGE_KEY] || {};
  let currentConfig = normalizeConfig(siteConfig[host] || DEFAULT_CONFIG);
  markActive(currentConfig);

  document.getElementById("enabledToggle").addEventListener("change", async (event) => {
    currentConfig = { enabled: event.target.checked };
    const normalized = normalizeConfig(currentConfig);
    await pushConfig(normalized);
    const stored = (await browser.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {};
    stored[host] = normalized;
    await browser.storage.local.set({ [STORAGE_KEY]: stored });
    markActive(normalized);
  });
}

init().catch((err) => {
  console.error("Popup init failed", err);
});
