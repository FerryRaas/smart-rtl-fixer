const STORAGE_KEY = "siteConfigV2";
const DEFAULT_CONFIG = { enabled: false, mode: "smart" };
const VALID_MODES = new Set(["smart", "deep"]);

function normalizeMode(mode) {
  return VALID_MODES.has(mode) ? mode : DEFAULT_CONFIG.mode;
}

function normalizeConfig(config) {
  const safe = config && typeof config === "object" ? config : {};
  return {
    enabled: Boolean(safe.enabled),
    mode: normalizeMode(safe.mode)
  };
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
  const finalConfig = normalizeConfig(config);
  const enabledToggle = document.getElementById("enabledToggle");
  enabledToggle.checked = finalConfig.enabled;

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    const isOff = btn.dataset.mode === "off";
    const isActive = isOff ? !finalConfig.enabled : finalConfig.enabled && btn.dataset.mode === finalConfig.mode;
    btn.classList.toggle("active", isActive);
    if (!isOff) {
      btn.disabled = !finalConfig.enabled;
    }
  });
}

async function pushConfig(config) {
  const tab = await getActiveTab();
  if (!tab || !tab.id) return;

  await browser.tabs.sendMessage(tab.id, {
    type: "SMART_RTL_SET_CONFIG",
    config: normalizeConfig(config)
  });
}

async function saveAndApply(config) {
  const finalConfig = normalizeConfig(config);
  await pushConfig(finalConfig);
  markActive(finalConfig);
}

async function init() {
  const tab = await getActiveTab();
  const host = getHostnameFromUrl(tab.url || "");
  document.getElementById("host").textContent = host;

  let currentConfig = await getStoredConfig(host);
  markActive(currentConfig);

  document.getElementById("enabledToggle").addEventListener("change", async (event) => {
    currentConfig = {
      ...currentConfig,
      enabled: event.target.checked
    };
    await saveAndApply(currentConfig);
  });

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.dataset.mode === "off") {
        currentConfig = { ...currentConfig, enabled: false };
      } else {
        currentConfig = {
          enabled: true,
          mode: normalizeMode(btn.dataset.mode)
        };
      }
      await saveAndApply(currentConfig);
    });
  });
}

init().catch((err) => {
  console.error("Popup init failed", err);
});
