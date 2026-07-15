(() => {
  "use strict";

  const BASE_TITLE = "Cold Print | 参考小説ライブラリ";
  const CATALOG_URL = new URL(
    "./novel-sample-genre-inventory.csv",
    document.baseURI,
  );
  const NOVEL_DIRECTORY_URL = new URL("./novels/", document.baseURI);
  const META_COLUMNS = ["ファイル名", "タイトル", "重複元ファイル"];

  const elements = {
    body: document.body,
    skipLink: document.querySelector(".skip-link"),
    portalView: document.querySelector("#portal-view"),
    portalTitle: document.querySelector("#portal-title"),
    novelTotal: document.querySelector("#novel-total"),
    genreTotal: document.querySelector("#genre-total"),
    titleSearch: document.querySelector("#title-search"),
    genreFilterList: document.querySelector("#genre-filter-list"),
    selectedGenreCount: document.querySelector("#selected-genre-count"),
    clearFilters: document.querySelector("#clear-filters"),
    catalogStatus: document.querySelector("#catalog-status"),
    novelList: document.querySelector("#novel-list"),
    catalogEmpty: document.querySelector("#catalog-empty"),
    readerView: document.querySelector("#reader-view"),
    readerArticle: document.querySelector("#reader-article"),
    readerTitle: document.querySelector("#reader-title"),
    readerTags: document.querySelector("#reader-tags"),
    readerStatus: document.querySelector("#reader-status"),
    readerBody: document.querySelector("#reader-body"),
    readerFooter: document.querySelector("#reader-footer"),
    readingProgressBar: document.querySelector("#reading-progress-bar"),
  };

  const state = {
    catalogReady: false,
    novels: [],
    displayNovels: [],
    novelsByFilename: new Map(),
    genreNames: [],
    activeGenres: new Set(),
    query: "",
    textCache: new Map(),
    currentFilename: null,
    requestController: null,
    routeToken: 0,
    scrollFrame: null,
  };

  bindEvents();
  prepareInitialHistoryState();
  prepareInitialView();
  loadCatalog();

  function bindEvents() {
    elements.skipLink.addEventListener("click", (event) => {
      event.preventDefault();
      const heading = elements.body.dataset.view === "reader"
        ? elements.readerTitle
        : elements.portalTitle;
      heading.focus({ preventScroll: false });
    });

    elements.titleSearch.addEventListener("input", (event) => {
      state.query = event.currentTarget.value;
      renderCatalog();
    });

    elements.genreFilterList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-genre]");
      if (!button) {
        return;
      }

      const genre = button.dataset.genre;
      if (state.activeGenres.has(genre)) {
        state.activeGenres.delete(genre);
      } else {
        state.activeGenres.add(genre);
      }
      renderCatalog();
    });

    elements.clearFilters.addEventListener("click", clearAllFilters);
    elements.catalogEmpty.addEventListener("click", (event) => {
      if (event.target.closest('[data-action="clear-filters"]')) {
        clearAllFilters();
      }
    });

    elements.novelList.addEventListener("click", handleNovelLinkClick);

    document.querySelectorAll('[data-action="back-to-portal"]').forEach((button) => {
      button.addEventListener("click", returnToPortal);
    });

    window.addEventListener("popstate", routeToCurrentLocation);
    window.addEventListener("scroll", requestProgressUpdate, { passive: true });
    window.addEventListener("resize", requestProgressUpdate);
  }

  function prepareInitialHistoryState() {
    const existingState = isPlainObject(history.state) ? history.state : {};
    const route = readRoute();
    history.replaceState(
      {
        ...existingState,
        view: route.type === "novel" ? "reader" : "portal",
        directEntry: route.type === "novel" && !existingState.fromPortal,
      },
      "",
      location.href,
    );
  }

  function prepareInitialView() {
    if (readRoute().type !== "novel") {
      return;
    }

    elements.portalView.hidden = true;
    elements.readerView.hidden = false;
    elements.body.dataset.view = "reader";
    elements.readerTitle.textContent = "作品情報を読み込んでいます";
    elements.readerStatus.textContent = "作品情報を読み込んでいます…";
    elements.readerBody.hidden = true;
    elements.readerFooter.hidden = true;
  }

  async function loadCatalog() {
    setCatalogLoading();

    try {
      const response = await fetch(CATALOG_URL);
      if (!response.ok) {
        throw new Error(`作品一覧を取得できませんでした（HTTP ${response.status}）`);
      }

      const csvText = await response.text();
      const catalog = buildCatalog(csvText);
      state.novels = catalog.novels;
      state.displayNovels = catalog.displayNovels;
      state.novelsByFilename = catalog.novelsByFilename;
      state.genreNames = catalog.genreNames;
      state.catalogReady = true;

      elements.novelTotal.textContent = String(state.displayNovels.length);
      elements.genreTotal.textContent = String(state.genreNames.length);
      renderGenreFilters();
      renderCatalog();
      routeToCurrentLocation();
    } catch (error) {
      state.catalogReady = false;
      showCatalogError(error);
    }
  }

  function setCatalogLoading() {
    elements.catalogStatus.className = "catalog-status";
    elements.catalogStatus.textContent = "作品情報を読み込んでいます…";
    elements.novelList.replaceChildren();
    elements.catalogEmpty.hidden = true;
  }

  function showCatalogError(error) {
    showPortal({ focusPortalTitle: false, restorePosition: false });
    elements.catalogStatus.className = "catalog-status catalog-status--error";
    elements.catalogStatus.textContent = "作品情報を読み込めませんでした。";
    elements.novelList.hidden = false;
    elements.catalogEmpty.hidden = true;

    const errorBox = document.createElement("div");
    errorBox.className = "empty-state";

    const title = document.createElement("p");
    title.className = "empty-state__title";
    title.textContent = "作品棚を開けませんでした";

    const detail = document.createElement("p");
    detail.textContent = readableErrorMessage(error);

    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.className = "secondary-button";
    retryButton.textContent = "もう一度読み込む";
    retryButton.addEventListener("click", loadCatalog, { once: true });

    errorBox.append(title, detail, retryButton);
    elements.novelList.replaceChildren(errorBox);
  }

  function buildCatalog(csvText) {
    const table = parseCsv(csvText);
    if (table.length < 2) {
      throw new Error("CSVに作品情報がありません。");
    }

    const headers = table[0].map((header) => header.trim());
    const missingColumns = META_COLUMNS.filter((column) => !headers.includes(column));
    if (missingColumns.length > 0) {
      throw new Error(`CSVの必須列がありません: ${missingColumns.join("、")}`);
    }

    if (new Set(headers).size !== headers.length) {
      throw new Error("CSVに同じ名前の列が複数あります。");
    }

    const genreNames = headers.filter((header) => !META_COLUMNS.includes(header));
    if (genreNames.length === 0) {
      throw new Error("CSVにジャンル列がありません。");
    }

    const novels = [];
    const novelsByFilename = new Map();

    table.slice(1).forEach((fields, rowIndex) => {
      if (fields.length !== headers.length) {
        throw new Error(
          `CSV ${rowIndex + 2}行目の列数が正しくありません（${fields.length}列）。`,
        );
      }

      const row = Object.fromEntries(
        headers.map((header, index) => [header, fields[index].trim()]),
      );
      const filename = row["ファイル名"];
      const title = row["タイトル"];
      const duplicateOf = row["重複元ファイル"];

      if (!filename || !title) {
        throw new Error(`CSV ${rowIndex + 2}行目のファイル名またはタイトルが空です。`);
      }
      if (novelsByFilename.has(filename)) {
        throw new Error(`CSVに同じファイル名が複数あります: ${filename}`);
      }

      const invalidGenre = genreNames.find(
        (genre) => row[genre] !== "0" && row[genre] !== "1",
      );
      if (invalidGenre) {
        throw new Error(
          `CSV ${rowIndex + 2}行目の「${invalidGenre}」は0または1ではありません。`,
        );
      }

      const novel = {
        filename,
        title,
        duplicateOf,
        genres: genreNames.filter((genre) => row[genre] === "1"),
      };
      novels.push(novel);
      novelsByFilename.set(filename, novel);
    });

    novels.forEach((novel) => {
      if (novel.duplicateOf && !novelsByFilename.has(novel.duplicateOf)) {
        throw new Error(
          `重複元ファイルが作品一覧にありません: ${novel.duplicateOf}`,
        );
      }
    });

    const displayNovels = novels
      .filter((novel) => !novel.duplicateOf)
      .map((novel, index) => ({ ...novel, displayNumber: index + 1 }));

    return { novels, displayNovels, novelsByFilename, genreNames };
  }

  function renderGenreFilters() {
    const genreCounts = new Map(
      state.genreNames.map((genre) => [
        genre,
        state.displayNovels.filter((novel) => novel.genres.includes(genre)).length,
      ]),
    );
    const fragment = document.createDocumentFragment();

    state.genreNames.forEach((genre) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.genre = genre;
      button.setAttribute("aria-pressed", "false");
      button.append(document.createTextNode(genre));

      const count = document.createElement("span");
      count.textContent = String(genreCounts.get(genre));
      count.setAttribute("aria-label", `${genreCounts.get(genre)}作品`);
      button.append(count);
      fragment.append(button);
    });

    elements.genreFilterList.replaceChildren(fragment);
  }

  function renderCatalog() {
    if (!state.catalogReady) {
      return;
    }

    const query = normalizeForSearch(state.query);
    const matchingNovels = state.displayNovels.filter((novel) => {
      const matchesQuery =
        !query ||
        normalizeForSearch(novel.title).includes(query) ||
        normalizeForSearch(novel.filename).includes(query);
      const matchesGenres = [...state.activeGenres].every((genre) =>
        novel.genres.includes(genre),
      );
      return matchesQuery && matchesGenres;
    });

    const fragment = document.createDocumentFragment();
    matchingNovels.forEach((novel) => fragment.append(createNovelCard(novel)));
    elements.novelList.replaceChildren(fragment);
    elements.novelList.hidden = matchingNovels.length === 0;
    elements.catalogEmpty.hidden = matchingNovels.length !== 0;

    updateCatalogStatus(matchingNovels.length);
    updateFilterControls();
  }

  function createNovelCard(novel) {
    const item = document.createElement("div");
    item.className = "novel-card-item";
    item.setAttribute("role", "listitem");

    const link = document.createElement("a");
    link.className = "novel-card";
    link.setAttribute("href", buildNovelHash(novel.filename));
    link.dataset.filename = novel.filename;

    const number = document.createElement("span");
    number.className = "novel-card__number";
    number.setAttribute("aria-hidden", "true");
    number.textContent = `No. ${String(novel.displayNumber).padStart(3, "0")}`;

    const title = document.createElement("span");
    title.className = "novel-card__title";
    title.textContent = novel.title;

    link.append(number, title, createTagList(novel.genres));
    item.append(link);
    return item;
  }

  function createTagList(genres) {
    const list = document.createElement("span");
    list.className = "tag-list";

    genres.forEach((genre) => {
      const tag = document.createElement("span");
      tag.className = "genre-tag";
      tag.textContent = genre;
      list.append(tag);
    });
    return list;
  }

  function updateCatalogStatus(matchingCount) {
    const hasFilters = Boolean(state.query.trim()) || state.activeGenres.size > 0;
    const count = document.createElement("strong");
    count.textContent = String(matchingCount);

    const suffix = hasFilters
      ? ` / ${state.displayNovels.length}作品を表示`
      : `作品を収録（重複${state.novels.length - state.displayNovels.length}件を除外）`;
    elements.catalogStatus.className = "catalog-status";
    elements.catalogStatus.replaceChildren(count, document.createTextNode(suffix));
  }

  function updateFilterControls() {
    elements.genreFilterList.querySelectorAll("button[data-genre]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(state.activeGenres.has(button.dataset.genre)),
      );
    });

    const selectedCount = state.activeGenres.size;
    elements.selectedGenreCount.textContent = selectedCount
      ? `${selectedCount}件を選択`
      : "未選択";
    elements.clearFilters.hidden = !state.query.trim() && selectedCount === 0;
  }

  function clearAllFilters() {
    state.query = "";
    state.activeGenres.clear();
    elements.titleSearch.value = "";
    renderCatalog();
    elements.titleSearch.focus();
  }

  function handleNovelLinkClick(event) {
    const link = event.target.closest("a[data-filename]");
    if (!link || event.defaultPrevented) {
      return;
    }
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    const filename = link.dataset.filename;
    const currentState = isPlainObject(history.state) ? history.state : {};
    history.replaceState(
      {
        ...currentState,
        view: "portal",
        portalScrollY: window.scrollY,
        lastFocusedFilename: filename,
      },
      "",
      location.href,
    );
    history.pushState(
      { view: "reader", fromPortal: true, filename },
      "",
      buildNovelHash(filename),
    );
    routeToCurrentLocation();
  }

  function routeToCurrentLocation() {
    if (!state.catalogReady) {
      return;
    }

    const route = readRoute();
    if (route.type === "portal") {
      showPortal();
      return;
    }
    if (route.type === "invalid") {
      showMissingNovel("URLの作品名を読み取れませんでした。");
      return;
    }

    const novel = state.novelsByFilename.get(route.filename);
    if (!novel) {
      showMissingNovel("指定された作品は、この作品棚に登録されていません。");
      return;
    }

    showNovel(novel);
  }

  function showPortal(options = {}) {
    cancelCurrentRequest();
    state.currentFilename = null;
    elements.readerView.hidden = true;
    elements.portalView.hidden = false;
    elements.body.dataset.view = "portal";
    elements.readingProgressBar.style.width = "0%";
    document.title = BASE_TITLE;

    if (options.restorePosition === false) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      if (options.focusPortalTitle) {
        requestAnimationFrame(() => elements.portalTitle.focus({ preventScroll: true }));
      }
      return;
    }

    const historyData = isPlainObject(history.state) ? history.state : {};
    const scrollY = Number.isFinite(historyData.portalScrollY)
      ? historyData.portalScrollY
      : 0;
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
      if (historyData.lastFocusedFilename) {
        const card = [...elements.novelList.querySelectorAll("a[data-filename]")].find(
          (candidate) =>
            candidate.dataset.filename === historyData.lastFocusedFilename,
        );
        card?.focus({ preventScroll: true });
      }
    });
  }

  async function showNovel(novel, options = {}) {
    cancelCurrentRequest();
    const routeToken = ++state.routeToken;
    state.currentFilename = novel.filename;

    elements.portalView.hidden = true;
    elements.readerView.hidden = false;
    elements.body.dataset.view = "reader";
    elements.readerTitle.textContent = novel.title;
    elements.readerTags.replaceChildren(...createGenreTags(novel.genres));
    elements.readerBody.hidden = true;
    elements.readerBody.textContent = "";
    elements.readerFooter.hidden = true;
    elements.readerStatus.hidden = false;
    elements.readerStatus.className = "reader-status";
    elements.readerStatus.textContent = "本文を読み込んでいます…";
    elements.readerArticle.setAttribute("aria-busy", "true");
    document.title = `${novel.title} | Cold Print`;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    requestAnimationFrame(() => elements.readerTitle.focus({ preventScroll: true }));
    requestProgressUpdate();

    if (!options.forceReload && state.textCache.has(novel.filename)) {
      renderNovelText(state.textCache.get(novel.filename));
      return;
    }

    const controller = new AbortController();
    state.requestController = controller;

    try {
      const novelUrl = new URL(encodeURIComponent(novel.filename), NOVEL_DIRECTORY_URL);
      const response = await fetch(novelUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`本文を取得できませんでした（HTTP ${response.status}）`);
      }

      const rawText = await response.text();
      const novelText = rawText.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
      if (routeToken !== state.routeToken || state.currentFilename !== novel.filename) {
        return;
      }

      state.textCache.set(novel.filename, novelText);
      renderNovelText(novelText);
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      if (routeToken === state.routeToken && state.currentFilename === novel.filename) {
        showReaderError(novel, error);
      }
    } finally {
      if (state.requestController === controller) {
        state.requestController = null;
      }
    }
  }

  function renderNovelText(text) {
    elements.readerBody.textContent = text;
    elements.readerBody.hidden = false;
    elements.readerStatus.hidden = true;
    elements.readerFooter.hidden = false;
    elements.readerArticle.setAttribute("aria-busy", "false");
    requestProgressUpdate();
  }

  function showReaderError(novel, error) {
    elements.readerBody.hidden = true;
    elements.readerFooter.hidden = true;
    elements.readerArticle.setAttribute("aria-busy", "false");
    elements.readerStatus.hidden = false;
    elements.readerStatus.className = "reader-status reader-status--error";

    const title = document.createElement("p");
    title.className = "reader-status__title";
    title.textContent = "本文を開けませんでした";

    const detail = document.createElement("p");
    detail.className = "reader-status__detail";
    detail.textContent = readableErrorMessage(error);

    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.className = "secondary-button";
    retryButton.textContent = "もう一度読み込む";
    retryButton.addEventListener(
      "click",
      () => showNovel(novel, { forceReload: true }),
      { once: true },
    );

    elements.readerStatus.replaceChildren(title, detail, retryButton);
  }

  function showMissingNovel(message) {
    cancelCurrentRequest();
    state.currentFilename = null;
    elements.portalView.hidden = true;
    elements.readerView.hidden = false;
    elements.body.dataset.view = "reader";
    elements.readerTitle.textContent = "作品が見つかりません";
    elements.readerTags.replaceChildren();
    elements.readerBody.hidden = true;
    elements.readerFooter.hidden = true;
    elements.readerArticle.setAttribute("aria-busy", "false");
    elements.readerStatus.hidden = false;
    elements.readerStatus.className = "reader-status reader-status--error";

    const title = document.createElement("p");
    title.className = "reader-status__title";
    title.textContent = "この作品は表示できません";

    const detail = document.createElement("p");
    detail.className = "reader-status__detail";
    detail.textContent = message;
    elements.readerStatus.replaceChildren(title, detail);
    document.title = "作品が見つかりません | Cold Print";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    requestAnimationFrame(() => elements.readerTitle.focus({ preventScroll: true }));
  }

  function createGenreTags(genres) {
    return genres.map((genre) => {
      const tag = document.createElement("span");
      tag.className = "genre-tag";
      tag.textContent = genre;
      return tag;
    });
  }

  function returnToPortal() {
    const historyData = isPlainObject(history.state) ? history.state : {};
    if (historyData.view === "reader" && historyData.fromPortal) {
      history.back();
      return;
    }

    const portalUrl = new URL(location.href);
    portalUrl.hash = "";
    history.replaceState(
      { view: "portal", portalScrollY: 0 },
      "",
      `${portalUrl.pathname}${portalUrl.search}`,
    );
    showPortal({ focusPortalTitle: true, restorePosition: false });
  }

  function cancelCurrentRequest() {
    state.routeToken += 1;
    if (state.requestController) {
      state.requestController.abort();
      state.requestController = null;
    }
  }

  function readRoute() {
    if (!location.hash.startsWith("#novel=")) {
      return { type: "portal" };
    }

    const encodedFilename = location.hash.slice("#novel=".length);
    if (!encodedFilename) {
      return { type: "invalid" };
    }

    try {
      return { type: "novel", filename: decodeURIComponent(encodedFilename) };
    } catch {
      return { type: "invalid" };
    }
  }

  function buildNovelHash(filename) {
    return `#novel=${encodeURIComponent(filename)}`;
  }

  function requestProgressUpdate() {
    if (state.scrollFrame !== null) {
      return;
    }
    state.scrollFrame = requestAnimationFrame(() => {
      state.scrollFrame = null;
      updateReadingProgress();
    });
  }

  function updateReadingProgress() {
    if (elements.body.dataset.view !== "reader") {
      elements.readingProgressBar.style.width = "0%";
      return;
    }

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollableHeight > 0 ? (scrollTop / scrollableHeight) * 100 : 0;
    const boundedProgress = Math.min(100, Math.max(0, progress));
    elements.readingProgressBar.style.width = `${boundedProgress}%`;
  }

  function normalizeForSearch(value) {
    return value.normalize("NFKC").toLocaleLowerCase("ja-JP");
  }

  function readableErrorMessage(error) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return "通信状態とファイルの配置を確認して、もう一度お試しください。";
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function parseCsv(source) {
    const text = source.replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    const finishRow = () => {
      row.push(field);
      if (!(row.length === 1 && row[0] === "")) {
        rows.push(row);
      }
      row = [];
      field = "";
    };

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];

      if (character === '"') {
        if (inQuotes && text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (inQuotes) {
          inQuotes = false;
        } else if (field.length === 0) {
          inQuotes = true;
        } else {
          field += character;
        }
      } else if (character === "," && !inQuotes) {
        row.push(field);
        field = "";
      } else if ((character === "\n" || character === "\r") && !inQuotes) {
        if (character === "\r" && text[index + 1] === "\n") {
          index += 1;
        }
        finishRow();
      } else if (character === "\r" && inQuotes) {
        if (text[index + 1] === "\n") {
          index += 1;
        }
        field += "\n";
      } else {
        field += character;
      }
    }

    if (inQuotes) {
      throw new Error("CSV内に閉じられていない引用符があります。");
    }
    if (field !== "" || row.length > 0) {
      finishRow();
    }
    return rows;
  }
})();
