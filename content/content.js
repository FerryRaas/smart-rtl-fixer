(function () {
  if (window.__smartRtlFixerLoaded) return;
  window.__smartRtlFixerLoaded = true;

  const STORAGE_KEY = "siteConfigV2";
  const STYLE_ID = "smart-rtl-fixer-style";
  const ATTR_MODE = "data-smart-rtl-fixer-mode";
  const DEFAULT_CONFIG = { enabled: false, mode: "smart" };
  const VALID_MODES = new Set(["smart", "deep"]);

  const CODE_TAGS = ["pre", "code", "kbd", "samp", "textarea", "input", "select", "option"];

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
    const p = `html[${ATTR_MODE}="${mode}"]`;
    const codeSel = CODE_TAGS.map(t => `${p} ${t}`).join(",\n        ");
    const codeNot = CODE_TAGS.map(t => `:not(${t})`).join("");

    const codeBlock = `
      ${codeSel} {
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: isolate !important;
      }`;

    if (mode === "deep") {
      return `
        ${p} body *${codeNot} {
          unicode-bidi: plaintext !important;
          text-align: start !important;
        }
        ${codeBlock}
      `;
    }

    // smart mode
    const blockSel = [
      "p", "div", "li", "td", "th",
      "blockquote", "article", "section", "main", "aside",
      "header", "footer", "nav",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "dd", "dt", "figcaption", "caption",
      "details", "summary", "address"
    ].map(t => `${p} ${t}`).concat([
      `${p} [role="paragraph"]`,
      `${p} [role="listitem"]`,
      `${p} [role="heading"]`,
      `${p} [data-message-author-role]`,
      `${p} [data-testid*="message"]`,
      `${p} .markdown`,
      `${p} .prose`
    ]).join(",\n        ");

    const inlineSel = [
      "span", "a", "em", "strong", "b", "i", "cite", "q", "label", "button"
    ].map(t => `${p} ${t}`).join(",\n        ");

    // Sites that hardcode dir="ltr" on elements
    const dirOverrideSel = [
      `${p} [dir="ltr"]${codeNot}`,
      `${p} [dir="LTR"]${codeNot}`
    ].join(",\n        ");

    return `
      ${blockSel} {
        direction: auto !important;
        unicode-bidi: plaintext !important;
        text-align: start !important;
      }

      ${inlineSel} {
        unicode-bidi: isolate !important;
      }

      ${dirOverrideSel} {
        direction: auto !important;
        unicode-bidi: plaintext !important;
        text-align: start !important;
      }

      ${codeBlock}
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
    stopObserver();
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
    startObserver(finalConfig.mode);
  }

  // MutationObserver: re-stamps the mode attribute if the site removes it dynamically
  let _observer = null;

  function startObserver(mode) {
    stopObserver();
    _observer = new MutationObserver(() => {
      const current = document.documentElement.getAttribute(ATTR_MODE);
      if (current !== mode) {
        document.documentElement.setAttribute(ATTR_MODE, mode);
      }
    });
    _observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [ATTR_MODE]
    });
  }

  function stopObserver() {
    if (_observer) {
      _observer.disconnect();
      _observer = null;
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
