(function () {
  if (window.__smartRtlFixerLoaded) return;
  window.__smartRtlFixerLoaded = true;

  const STORAGE_KEY = "siteConfigV2";
  const STYLE_ID = "smart-rtl-fixer-style";
  const ATTR_MODE = "data-smart-rtl-fixer-mode";
  const DEFAULT_CONFIG = { enabled: false, mode: "smart" };
  const VALID_MODES = new Set(["smart", "deep"]);

  function getHostname() {
    try {
      return location.hostname || location.origin || "unknown";
    } catch (_) {
      return "unknown";
    }
  }

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

  function getCssForMode(mode) {
    if (mode === "deep") {
      return `
        html[${ATTR_MODE}="deep"] body :not(pre):not(code):not(kbd):not(samp):not(textarea):not(input):not(select):not(option) {
          unicode-bidi: plaintext !important;
        }

        html[${ATTR_MODE}="deep"] pre,
        html[${ATTR_MODE}="deep"] code,
        html[${ATTR_MODE}="deep"] kbd,
        html[${ATTR_MODE}="deep"] samp,
        html[${ATTR_MODE}="deep"] textarea,
        html[${ATTR_MODE}="deep"] input,
        html[${ATTR_MODE}="deep"] select,
        html[${ATTR_MODE}="deep"] option {
          direction: ltr !important;
          text-align: left !important;
          unicode-bidi: isolate !important;
        }
      `;
    }

    return `
      html[${ATTR_MODE}="smart"] p,
      html[${ATTR_MODE}="smart"] div,
      html[${ATTR_MODE}="smart"] span,
      html[${ATTR_MODE}="smart"] li,
      html[${ATTR_MODE}="smart"] td,
      html[${ATTR_MODE}="smart"] th,
      html[${ATTR_MODE}="smart"] blockquote,
      html[${ATTR_MODE}="smart"] article,
      html[${ATTR_MODE}="smart"] section,
      html[${ATTR_MODE}="smart"] main,
      html[${ATTR_MODE}="smart"] aside,
      html[${ATTR_MODE}="smart"] header,
      html[${ATTR_MODE}="smart"] footer,
      html[${ATTR_MODE}="smart"] nav,
      html[${ATTR_MODE}="smart"] h1,
      html[${ATTR_MODE}="smart"] h2,
      html[${ATTR_MODE}="smart"] h3,
      html[${ATTR_MODE}="smart"] h4,
      html[${ATTR_MODE}="smart"] h5,
      html[${ATTR_MODE}="smart"] h6,
      html[${ATTR_MODE}="smart"] label,
      html[${ATTR_MODE}="smart"] button,
      html[${ATTR_MODE}="smart"] [role="paragraph"],
      html[${ATTR_MODE}="smart"] [data-message-author-role],
      html[${ATTR_MODE}="smart"] [data-testid*="message"],
      html[${ATTR_MODE}="smart"] .markdown,
      html[${ATTR_MODE}="smart"] .prose {
        direction: auto !important;
        unicode-bidi: plaintext !important;
      }

      html[${ATTR_MODE}="smart"] pre,
      html[${ATTR_MODE}="smart"] code,
      html[${ATTR_MODE}="smart"] kbd,
      html[${ATTR_MODE}="smart"] samp,
      html[${ATTR_MODE}="smart"] textarea,
      html[${ATTR_MODE}="smart"] input,
      html[${ATTR_MODE}="smart"] select,
      html[${ATTR_MODE}="smart"] option {
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: isolate !important;
      }
    `;
  }

  function ensureStyleTag() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    return style;
  }

  function clearMode() {
    const style = ensureStyleTag();
    style.textContent = "";
    document.documentElement.removeAttribute(ATTR_MODE);
    if (document.body) {
      document.body.removeAttribute(ATTR_MODE);
    }
  }

  function applyConfig(config) {
    const finalConfig = normalizeConfig(config);
    if (!finalConfig.enabled) {
      clearMode();
      return;
    }

    const style = ensureStyleTag();
    style.textContent = getCssForMode(finalConfig.mode);
    document.documentElement.setAttribute(ATTR_MODE, finalConfig.mode);
    if (document.body) {
      document.body.setAttribute(ATTR_MODE, finalConfig.mode);
    }
  }

  function readStoredConfig(callback) {
    const hostname = getHostname();
    browser.storage.local.get(STORAGE_KEY).then((result) => {
      const siteConfig = result[STORAGE_KEY] || {};
      callback(normalizeConfig(siteConfig[hostname] || DEFAULT_CONFIG));
    }).catch(() => {
      callback(DEFAULT_CONFIG);
    });
  }

  function writeStoredConfig(config) {
    const hostname = getHostname();
    const normalized = normalizeConfig(config);
    return browser.storage.local.get(STORAGE_KEY).then((result) => {
      const siteConfig = result[STORAGE_KEY] || {};
      siteConfig[hostname] = normalized;
      return browser.storage.local.set({ [STORAGE_KEY]: siteConfig });
    });
  }

  function init() {
    readStoredConfig(applyConfig);
  }

  browser.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "SMART_RTL_SET_CONFIG") return;
    const config = normalizeConfig(message.config);
    applyConfig(config);
    return writeStoredConfig(config).then(() => ({ ok: true, config }));
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
