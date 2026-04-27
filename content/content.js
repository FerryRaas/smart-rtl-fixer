(function () {
  if (window.__smartRtlFixerLoaded) return;
  window.__smartRtlFixerLoaded = true;

  const STORAGE_KEY = "siteConfigV2";
  const STYLE_ID = "smart-rtl-fixer-style";
  const ATTR_MODE = "data-smart-rtl-fixer-mode";
  const ATTR_FIXED = "data-smart-rtl-fixed";
  const DEFAULT_CONFIG = { enabled: false };

  const CODE_TAGS = new Set(["pre", "code", "kbd", "samp", "input", "select", "option"]);

  const JS_FIX_SELECTOR = [
    "p", "li", "td", "th", "blockquote",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "dd", "dt", "figcaption", "summary", "address", "textarea"
  ].join(",");

  const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
  const LATIN_RE  = /[a-zA-Z]/g;

  function getHostname() {
    try {
      return location.hostname || location.origin || "unknown";
    } catch (_) {
      return "unknown";
    }
  }

  function normalizeConfig(config) {
    const safe = config && typeof config === "object" ? config : {};
    return { enabled: Boolean(safe.enabled) };
  }

  // --- CSS ---
  // All non-code elements get unicode-bidi: plaintext so each element independently
  // detects its direction from its first strong character (P2/P3 Unicode rules),
  // ignoring inherited direction. This handles both Arabic-dominant paragraphs and
  // mixed inline elements like <strong>Claude Code أقوى بكثير</strong>.

  function getFixedCss() {
    const p = `html[${ATTR_MODE}="on"]`;
    const codeNot = [...CODE_TAGS].map(t => `:not(${t})`).join("");
    const codeSel = [...CODE_TAGS].map(t => `${p} ${t}`).join(",\n        ");

    return `
      ${p} body *${codeNot} {
        unicode-bidi: plaintext !important;
        text-align: start !important;
      }

      ${codeSel} {
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: isolate !important;
      }
    `;
  }

  // --- JS direction detection ---
  // Fixes paragraphs that start with an English word but are mostly Arabic.
  // unicode-bidi: plaintext uses first strong char (P2), so "Cowork مصمم..." → LTR.
  // This counts Arabic vs Latin chars and forces RTL+embed when Arabic dominates,
  // overriding the plaintext detection for those elements only.

  function isDominantlyArabic(text) {
    const trimmed = text.trim();
    if (!trimmed) return false;
    const arabic = (trimmed.match(ARABIC_RE) || []).length;
    const latin  = (trimmed.match(LATIN_RE)  || []).length;
    return arabic > 0 && arabic > latin;
  }

  function fixElementDirection(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    if (CODE_TAGS.has(el.tagName.toLowerCase())) return;

    if (isDominantlyArabic(el.textContent || "")) {
      el.style.setProperty("direction", "rtl", "important");
      el.style.setProperty("unicode-bidi", "embed", "important");
      el.style.setProperty("text-align", "start", "important");
      el.setAttribute(ATTR_FIXED, "1");
    } else if (el.hasAttribute(ATTR_FIXED)) {
      el.style.removeProperty("direction");
      el.style.removeProperty("unicode-bidi");
      el.style.removeProperty("text-align");
      el.removeAttribute(ATTR_FIXED);
    }
  }

  function fixAllElements() {
    document.querySelectorAll(JS_FIX_SELECTOR).forEach(fixElementDirection);
  }

  // Debounce for streaming text (e.g. Claude's token-by-token output)
  let _pendingFixes = new Set();
  let _fixTimer = null;

  function scheduleFixElement(el) {
    _pendingFixes.add(el);
    if (_fixTimer) return;
    _fixTimer = setTimeout(() => {
      _pendingFixes.forEach(fixElementDirection);
      _pendingFixes.clear();
      _fixTimer = null;
    }, 120);
  }

  // --- Observers ---

  let _attrObserver = null;
  let _contentObserver = null;

  function startObservers() {
    stopObservers();

    // Guard against sites removing our mode attribute
    _attrObserver = new MutationObserver(() => {
      if (document.documentElement.getAttribute(ATTR_MODE) !== "on") {
        document.documentElement.setAttribute(ATTR_MODE, "on");
      }
    });
    _attrObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [ATTR_MODE]
    });

    // Watch for new or updated content and apply JS direction fix
    _contentObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.matches(JS_FIX_SELECTOR)) scheduleFixElement(node);
          node.querySelectorAll(JS_FIX_SELECTOR).forEach(scheduleFixElement);
        }
        if (mutation.type === "characterData") {
          const parent = mutation.target.parentElement;
          const ancestor = parent && parent.closest(JS_FIX_SELECTOR);
          if (ancestor) scheduleFixElement(ancestor);
        }
      }
    });
    _contentObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    fixAllElements();
  }

  function stopObservers() {
    if (_attrObserver) { _attrObserver.disconnect(); _attrObserver = null; }
    if (_contentObserver) { _contentObserver.disconnect(); _contentObserver = null; }
    if (_fixTimer) { clearTimeout(_fixTimer); _fixTimer = null; }
    _pendingFixes.clear();
  }

  // --- Style tag ---

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
    ensureStyleTag().textContent = "";
    document.documentElement.removeAttribute(ATTR_MODE);
    if (document.body) document.body.removeAttribute(ATTR_MODE);
    stopObservers();
    document.querySelectorAll(`[${ATTR_FIXED}]`).forEach(el => {
      el.style.removeProperty("direction");
      el.style.removeProperty("unicode-bidi");
      el.style.removeProperty("text-align");
      el.removeAttribute(ATTR_FIXED);
    });
  }

  function applyConfig(config) {
    const finalConfig = normalizeConfig(config);
    if (!finalConfig.enabled) {
      clearMode();
      return;
    }

    ensureStyleTag().textContent = getFixedCss();
    document.documentElement.setAttribute(ATTR_MODE, "on");
    if (document.body) document.body.setAttribute(ATTR_MODE, "on");
    startObservers();
  }

  // --- Storage ---

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
