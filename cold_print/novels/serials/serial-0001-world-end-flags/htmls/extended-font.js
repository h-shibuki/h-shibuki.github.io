(() => {
  "use strict";

  const GENRE_META = Object.freeze({
    literary: Object.freeze({
      label: "文学・内省",
      description: "明朝中心。声の差より、余白と静かな書体差を優先",
    }),
    "military-sf": Object.freeze({
      label: "軍事・ハードSF",
      description: "地の文は明朝、会話は角ゴ、命令・端末は硬質な等幅",
    }),
    "logic-thriller": Object.freeze({
      label: "論理ミステリー",
      description: "推理本文、質問、数列、判定を別々の書体層へ分離",
    }),
    "school-action": Object.freeze({
      label: "学園活劇・コメディー",
      description: "丸ゴ・太ゴ・教本書式を使い分け、勢いと読みやすさを両立",
    }),
    "web-fantasy": Object.freeze({
      label: "Webファンタジー",
      description: "画面向け本文、能力名、世界記述、ツッコミを役割別に分離",
    }),
    "institutional-horror": Object.freeze({
      label: "制度ホラー",
      description: "本文は静かな明朝、規則と数字は等幅、怪異は細く異質に",
    }),
    "satirical-sf": Object.freeze({
      label: "風刺SF・日常コメディー",
      description: "親しみやすい本文と企業UI、食感、ツッコミの書体差を活用",
    }),
    "folklore-dark": Object.freeze({
      label: "伝奇・民俗ダーク",
      description: "名、鐘、儀式、白い書式を古典的な明朝と硬質書体で分離",
    }),
    "adventure-action": Object.freeze({
      label: "冒険・アクション",
      description: "転換と重大な選択を太ゴ、世界と余韻を明朝で対照",
    }),
    "romance-drama": Object.freeze({
      label: "恋愛・関係性ドラマ",
      description: "会話、記憶、名前の呼び方を柔らかな書体差と余白で表現",
    }),
    "absurd-comedy": Object.freeze({
      label: "不条理・ギャグ",
      description: "堅い書式と丸ゴの飛躍を切り替え、ツッコミの落差を強調",
    }),
    "historical-drama": Object.freeze({
      label: "歴史・時代劇",
      description: "古典的な明朝を基調に、名、文書、号令を格調の異なる層へ",
    }),
    "sports-competition": Object.freeze({
      label: "スポーツ・競技",
      description: "身体感覚と会話は読みやすく、記録、号令、決着を硬質書体で分離",
    }),
    "music-lyrical": Object.freeze({
      label: "音楽・抒情",
      description: "音、記憶、余韻を柔らかな書体で、譜面や数値は等幅書体で分離",
    }),
    "daily-work": Object.freeze({
      label: "日常・家族・お仕事",
      description: "画面向けの本文と丸みのある会話を基調に、業務情報と記憶を分離",
    }),
  });

  const ALLOWED_GENRES = new Set(Object.keys(GENRE_META));
  const ALLOWED_FONT_MODES = new Set(["full", "soft", "off"]);
  const ALLOWED_EFFECTS = new Set(["full", "soft", "off"]);
  const ALLOWED_THEMES = new Set(["paper", "night"]);
  const MIN_SCALE = 0.88;
  const MAX_SCALE = 1.22;
  const SCALE_STEP = 0.06;

  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    callback();
  }

  ready(() => {
    const body = document.body;
    if (!body) return;

    const genreSelect = document.getElementById("genreSelect");
    const fontModeSelect = document.getElementById("fontModeSelect");
    const effectsSelect = document.getElementById("effectsSelect");
    const themeButton = document.getElementById("themeButton");
    const sizeDownButton = document.getElementById("sizeDown");
    const sizeResetButton = document.getElementById("sizeReset");
    const sizeUpButton = document.getElementById("sizeUp");
    const scaleOutput = document.getElementById("readerScaleValue");
    const infoButton = document.getElementById("infoButton");
    const infoPanel = document.getElementById("infoPanel");
    const tocButton = document.getElementById("tocButton");
    const tocPanel = document.getElementById("tocPanel");
    const progressBar = document.getElementById("progressBar");
    const presetLabel = document.getElementById("currentPresetLabel");
    const presetDescription = document.getElementById("currentPresetDescription");
    const returnLink = document.getElementById("returnToPortal")
      || document.querySelector("[data-return-to-portal]");

    const hasOption = (select, value) => {
      if (!select) return true;
      return Array.from(select.options).some((option) => option.value === value);
    };

    const initialGenre = ALLOWED_GENRES.has(body.dataset.genre)
      && hasOption(genreSelect, body.dataset.genre)
      ? body.dataset.genre
      : "literary";
    const initialFontMode = ALLOWED_FONT_MODES.has(body.dataset.fontmode)
      ? body.dataset.fontmode
      : "full";
    const initialEffects = ALLOWED_EFFECTS.has(body.dataset.effects)
      ? body.dataset.effects
      : "full";
    const initialTheme = ALLOWED_THEMES.has(body.dataset.theme)
      ? body.dataset.theme
      : "paper";

    const state = {
      genre: initialGenre,
      fontmode: initialFontMode,
      effects: initialEffects,
      theme: initialTheme,
      scale: 1,
    };

    const rawSlug = body.dataset.slug || document.title || "novel";
    const slug = String(rawSlug).slice(0, 180);
    const storageKey = `cold-print:extended-font:${slug}`;

    function restore() {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (!saved || typeof saved !== "object" || Array.isArray(saved)) return;

        if (ALLOWED_GENRES.has(saved.genre) && hasOption(genreSelect, saved.genre)) {
          state.genre = saved.genre;
        }
        if (ALLOWED_FONT_MODES.has(saved.fontmode) && hasOption(fontModeSelect, saved.fontmode)) {
          state.fontmode = saved.fontmode;
        }
        if (ALLOWED_EFFECTS.has(saved.effects) && hasOption(effectsSelect, saved.effects)) {
          state.effects = saved.effects;
        }
        if (ALLOWED_THEMES.has(saved.theme)) {
          state.theme = saved.theme;
        }
        if (typeof saved.scale === "number" && Number.isFinite(saved.scale)) {
          state.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, saved.scale));
        }
      } catch (_error) {
        /* Storage may be disabled or contain invalid JSON; defaults remain usable. */
      }
    }

    function save() {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(state));
      } catch (_error) {
        /* Reading controls must continue to work when storage is unavailable. */
      }
    }

    function setSelectValue(select, value, allowed, fallback) {
      if (!select) return value;
      if (allowed.has(value) && hasOption(select, value)) {
        select.value = value;
        return value;
      }
      const option = Array.from(select.options).find((candidate) => allowed.has(candidate.value));
      const safeValue = option ? option.value : fallback;
      select.value = safeValue;
      return safeValue;
    }

    function updatePresetText() {
      const meta = GENRE_META[state.genre] || GENRE_META.literary;
      const selectedOption = genreSelect && genreSelect.selectedIndex >= 0
        ? genreSelect.options[genreSelect.selectedIndex]
        : null;
      if (presetLabel) {
        presetLabel.textContent = selectedOption?.textContent?.trim() || meta.label;
      }
      if (presetDescription) {
        presetDescription.textContent = selectedOption?.dataset.description || meta.description;
      }
    }

    function apply() {
      state.genre = setSelectValue(genreSelect, state.genre, ALLOWED_GENRES, "literary");
      state.fontmode = setSelectValue(fontModeSelect, state.fontmode, ALLOWED_FONT_MODES, "full");
      state.effects = setSelectValue(effectsSelect, state.effects, ALLOWED_EFFECTS, "full");
      if (!ALLOWED_THEMES.has(state.theme)) state.theme = "paper";
      state.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, state.scale));

      body.dataset.genre = state.genre;
      body.dataset.fontmode = state.fontmode;
      body.dataset.effects = state.effects;
      body.dataset.theme = state.theme;
      body.style.setProperty("--reader-scale", String(state.scale));

      const isNight = state.theme === "night";
      if (themeButton) {
        themeButton.setAttribute("aria-pressed", isNight ? "true" : "false");
        themeButton.setAttribute("aria-label", isNight ? "紙背景に切り替える" : "夜背景に切り替える");
      }

      const atMinimum = state.scale <= MIN_SCALE;
      const atMaximum = state.scale >= MAX_SCALE;
      if (sizeDownButton) sizeDownButton.disabled = atMinimum;
      if (sizeUpButton) sizeUpButton.disabled = atMaximum;
      if (scaleOutput) scaleOutput.textContent = `${Math.round(state.scale * 100)}%`;
      updatePresetText();
    }

    function applyAndSave() {
      apply();
      save();
    }

    function readAllowedSelect(select, allowed, currentValue) {
      const candidate = select?.value;
      return typeof candidate === "string" && allowed.has(candidate)
        ? candidate
        : currentValue;
    }

    genreSelect?.addEventListener("change", () => {
      state.genre = readAllowedSelect(genreSelect, ALLOWED_GENRES, state.genre);
      applyAndSave();
    });
    fontModeSelect?.addEventListener("change", () => {
      state.fontmode = readAllowedSelect(fontModeSelect, ALLOWED_FONT_MODES, state.fontmode);
      applyAndSave();
    });
    effectsSelect?.addEventListener("change", () => {
      state.effects = readAllowedSelect(effectsSelect, ALLOWED_EFFECTS, state.effects);
      applyAndSave();
    });
    themeButton?.addEventListener("click", () => {
      state.theme = state.theme === "night" ? "paper" : "night";
      applyAndSave();
    });
    sizeDownButton?.addEventListener("click", () => {
      state.scale = Math.max(MIN_SCALE, Number((state.scale - SCALE_STEP).toFixed(2)));
      applyAndSave();
    });
    sizeResetButton?.addEventListener("click", () => {
      state.scale = 1;
      applyAndSave();
    });
    sizeUpButton?.addEventListener("click", () => {
      state.scale = Math.min(MAX_SCALE, Number((state.scale + SCALE_STEP).toFixed(2)));
      applyAndSave();
    });

    const panelPairs = [
      [tocButton, tocPanel],
      [infoButton, infoPanel],
    ];

    function closePanels(exceptPanel = null, restoreFocus = false) {
      let buttonToFocus = null;
      panelPairs.forEach(([button, panel]) => {
        if (!button || !panel || panel === exceptPanel || panel.hidden) return;
        panel.hidden = true;
        button.setAttribute("aria-expanded", "false");
        buttonToFocus = button;
      });
      if (restoreFocus && buttonToFocus) buttonToFocus.focus();
    }

    function togglePanel(button, panel) {
      if (!button || !panel) return;
      const opening = panel.hidden;
      closePanels(opening ? panel : null);
      panel.hidden = !opening;
      button.setAttribute("aria-expanded", opening ? "true" : "false");
    }

    tocButton?.addEventListener("click", () => togglePanel(tocButton, tocPanel));
    infoButton?.addEventListener("click", () => togglePanel(infoButton, infoPanel));

    /* Scroll to chapters without adding iframe hash entries to joint history. */
    tocPanel?.addEventListener("click", (event) => {
      const link = event.target.closest("a[href^='#']");
      if (!link || !tocPanel.contains(link)) return;
      const rawHref = link.getAttribute("href");
      if (!rawHref || rawHref.length > 200 || rawHref[0] !== "#") return;

      let id;
      try {
        id = decodeURIComponent(rawHref.slice(1));
      } catch (_error) {
        return;
      }
      const target = id ? document.getElementById(id) : null;
      if (!target || !target.closest("article.novel")) return;

      event.preventDefault();
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      togglePanel(tocButton, tocPanel);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePanels(null, true);
    });

    document.addEventListener("click", (event) => {
      if (panelPairs.some(([button, panel]) => button?.contains(event.target) || panel?.contains(event.target))) {
        return;
      }
      closePanels();
    });

    let progressFrame = 0;
    function updateProgress() {
      progressFrame = 0;
      if (!progressBar) return;
      const scrollingElement = document.scrollingElement || document.documentElement;
      const maximum = scrollingElement.scrollHeight - scrollingElement.clientHeight;
      const progress = maximum > 0 ? scrollingElement.scrollTop / maximum : 0;
      const percentage = Math.min(100, Math.max(0, progress * 100));
      progressBar.style.width = `${percentage}%`;
    }

    function queueProgressUpdate() {
      if (progressFrame) return;
      progressFrame = window.requestAnimationFrame(updateProgress);
    }

    window.addEventListener("scroll", queueProgressUpdate, { passive: true });
    window.addEventListener("resize", queueProgressUpdate);
    window.addEventListener("load", queueProgressUpdate, { once: true });

    /*
     * The anchor remains a normal relative link for standalone and no-JS use.
     * Inside the portal iframe, the parent owns the route transition instead.
     */
    returnLink?.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0
        || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
        || window.parent === window) {
        return;
      }

      event.preventDefault();
      try {
        const targetOrigin = window.location.origin === "null" ? "*" : window.location.origin;
        window.parent.postMessage({
          type: "cold-print:return-to-portal",
          slug,
        }, targetOrigin);
      } catch (_error) {
        window.location.assign(returnLink.href);
      }
    });

    restore();
    apply();
    updateProgress();
  });
})();
(() => {
  "use strict";

  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[data-serial-navigation]");
    if (
      !link || event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || window.parent === window
    ) {
      return;
    }

    const seriesId = document.body?.dataset.seriesId || "";
    const episodeId = link.dataset.episodeId || null;
    if (!seriesId) return;

    event.preventDefault();
    try {
      const targetOrigin = window.location.origin === "null"
        ? "*"
        : window.location.origin;
      window.parent.postMessage({
        type: episodeId
          ? "cold-print:navigate-episode"
          : "cold-print:return-to-series",
        seriesId,
        episodeId,
      }, targetOrigin);
    } catch (_error) {
      window.location.assign(link.href);
    }
  });
})();
