(() => {
  "use strict";

  const BASE_TITLE = "Cold Print | 参考小説ライブラリ";
  const ONE_SHOT_CATALOG_URL = new URL(
    "./novel-sample-genre-inventory.csv",
    document.baseURI,
  );
  const SERIAL_CATALOG_URL = new URL(
    "./serial-novel-inventory.csv",
    document.baseURI,
  );
  const ONE_SHOT_DIRECTORY_URL = new URL("./novels/", document.baseURI);
  const SERIAL_DIRECTORY_URL = new URL("./novels/serials/", document.baseURI);

  const ONE_SHOT_META_COLUMNS = ["ファイル名", "タイトル", "重複元ファイル"];
  const SERIAL_META_COLUMNS = ["連載ID", "タイトル", "連載状態"];
  const EPISODE_COLUMNS = [
    "エピソードID",
    "表示順",
    "話数表示",
    "各話タイトル",
    "ファイル名",
  ];
  const SERIAL_STATES = new Set(["連載中", "完結", "休載"]);
  const SERIAL_ID_PATTERN = /^serial-[0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const EPISODE_ID_PATTERN = /^ep-[0-9]{3,}$/;
  const CATALOG_TYPES = ["one-shot", "serial"];
  const HISTORY_SNAPSHOT_INTERVAL = 200;

  const elements = {
    body: document.body,
    skipLink: document.querySelector(".skip-link"),
    portalView: document.querySelector("#portal-view"),
    portalTitle: document.querySelector("#portal-title"),
    workTotal: document.querySelector("#work-total"),
    genreTotal: document.querySelector("#genre-total"),
    catalogTabs: document.querySelector(".catalog-tabs"),
    catalogPanel: document.querySelector("#catalog-panel"),
    oneShotCount: document.querySelector("#one-shot-count"),
    serialCount: document.querySelector("#serial-count"),
    catalogTitle: document.querySelector("#catalog-title"),
    titleSearch: document.querySelector("#title-search"),
    genreFilterList: document.querySelector("#genre-filter-list"),
    selectedGenreCount: document.querySelector("#selected-genre-count"),
    clearFilters: document.querySelector("#clear-filters"),
    catalogStatus: document.querySelector("#catalog-status"),
    workList: document.querySelector("#work-list"),
    catalogEmpty: document.querySelector("#catalog-empty"),
    catalogEmptyTitle: document.querySelector("#catalog-empty-title"),
    catalogEmptyMessage: document.querySelector("#catalog-empty-message"),
    catalogEmptyButton: document.querySelector(
      '#catalog-empty [data-action="clear-filters"]',
    ),
    seriesView: document.querySelector("#series-view"),
    seriesTitle: document.querySelector("#series-title"),
    seriesState: document.querySelector("#series-state"),
    seriesTags: document.querySelector("#series-tags"),
    seriesSummary: document.querySelector("#series-summary"),
    seriesActions: document.querySelector("#series-actions"),
    firstEpisodeLink: document.querySelector("#first-episode-link"),
    latestEpisodeLink: document.querySelector("#latest-episode-link"),
    episodeCount: document.querySelector("#episode-count"),
    seriesStatus: document.querySelector("#series-status"),
    episodeList: document.querySelector("#episode-list"),
    readerView: document.querySelector("#reader-view"),
    readerBack: document.querySelector("#reader-back"),
    readerBackLabel: document.querySelector("#reader-back-label"),
    readerNavLabel: document.querySelector("#reader-nav-label"),
    readerArticle: document.querySelector("#reader-article"),
    readerKicker: document.querySelector("#reader-kicker"),
    readerSeriesTitle: document.querySelector("#reader-series-title"),
    readerTitle: document.querySelector("#reader-title"),
    readerTags: document.querySelector("#reader-tags"),
    readerStatus: document.querySelector("#reader-status"),
    readerBody: document.querySelector("#reader-body"),
    readerFooter: document.querySelector("#reader-footer"),
    oneShotFooterActions: document.querySelector("#one-shot-footer-actions"),
    episodeNavigationTop: document.querySelector("#episode-navigation-top"),
    episodeNavigationBottom: document.querySelector("#episode-navigation-bottom"),
    readingProgressBar: document.querySelector("#reading-progress-bar"),
  };

  const state = {
    catalogsLoaded: false,
    catalogs: {
      "one-shot": createCatalogState(),
      serial: createCatalogState(),
    },
    genreNames: [],
    activeCatalogType: "one-shot",
    filters: {
      "one-shot": createFilterState(),
      serial: createFilterState(),
    },
    seriesCache: new Map(),
    textCache: new Map(),
    currentReading: null,
    currentRouteKey: null,
    requestController: null,
    routeToken: 0,
    scrollFrame: null,
    suppressScrollSnapshot: false,
    scrollRestoreToken: 0,
    pendingSeriesFocus: null,
    historySnapshotTimer: null,
    lastHistorySnapshotTime: 0,
  };

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  bindEvents();
  prepareInitialHistoryState();
  prepareInitialView();
  loadCatalogs();

  function createCatalogState() {
    return {
      ready: false,
      error: null,
      items: [],
      allItems: [],
      itemMap: new Map(),
      genreNames: [],
    };
  }

  function createFilterState() {
    return { query: "", activeGenres: new Set() };
  }

  function bindEvents() {
    elements.skipLink.addEventListener("click", (event) => {
      event.preventDefault();
      const heading = elements.body.dataset.view === "reader"
        ? elements.readerTitle
        : elements.body.dataset.view === "series"
          ? elements.seriesTitle
          : elements.portalTitle;
      heading.focus({ preventScroll: false });
    });

    elements.catalogTabs.addEventListener("click", (event) => {
      const tab = event.target.closest("button[data-catalog-type]");
      if (tab) {
        switchCatalog(tab.dataset.catalogType, { focusTab: true });
      }
    });
    elements.catalogTabs.addEventListener("keydown", handleCatalogTabKeydown);

    elements.titleSearch.addEventListener("input", (event) => {
      getActiveFilter().query = event.currentTarget.value;
      renderCatalog();
    });

    elements.genreFilterList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-genre]");
      if (!button) {
        return;
      }

      const activeGenres = getActiveFilter().activeGenres;
      const genre = button.dataset.genre;
      if (activeGenres.has(genre)) {
        activeGenres.delete(genre);
      } else {
        activeGenres.add(genre);
      }
      renderCatalog();
    });

    elements.clearFilters.addEventListener("click", clearAllFilters);
    elements.catalogEmpty.addEventListener("click", (event) => {
      if (event.target.closest('[data-action="clear-filters"]')) {
        clearAllFilters();
      }
    });

    elements.workList.addEventListener("click", handleWorkLinkClick);
    elements.seriesView.addEventListener("click", handleSeriesViewClick);
    elements.readerView.addEventListener("click", handleReaderViewClick);
    document
      .querySelector('[data-action="series-to-portal"]')
      .addEventListener("click", returnFromSeriesToPortal);
    elements.readerBack.addEventListener("click", handleReaderBack);

    window.addEventListener("popstate", routeToCurrentLocation);
    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    window.addEventListener("scrollend", flushHistorySnapshot, { passive: true });
    window.addEventListener("resize", requestProgressUpdate);
  }

  function prepareInitialHistoryState() {
    const existingState = isPlainObject(history.state) ? history.state : {};
    const route = readRoute();
    const view = route.type === "series"
      ? "series"
      : route.type === "one-shot" || route.type === "episode"
        ? "reader"
        : "portal";
    const catalogType = route.type === "series" || route.type === "episode"
      ? "serial"
      : existingState.catalogType || "one-shot";

    history.replaceState(
      {
        ...existingState,
        view,
        catalogType,
        directEntry: view !== "portal" && !existingState.fromPortal,
      },
      "",
      location.href,
    );
  }

  function prepareInitialView() {
    const route = readRoute();
    if (route.type === "series") {
      elements.portalView.hidden = true;
      elements.seriesView.hidden = false;
      elements.readerView.hidden = true;
      elements.body.dataset.view = "series";
      return;
    }

    if (route.type === "one-shot" || route.type === "episode") {
      elements.portalView.hidden = true;
      elements.seriesView.hidden = true;
      elements.readerView.hidden = false;
      elements.body.dataset.view = "reader";
      elements.readerTitle.textContent = "作品情報を読み込んでいます";
      elements.readerStatus.textContent = "作品情報を読み込んでいます…";
      elements.readerBody.hidden = true;
      elements.readerFooter.hidden = true;
    }
  }

  async function loadCatalogs() {
    state.catalogsLoaded = false;
    state.catalogs["one-shot"] = createCatalogState();
    state.catalogs.serial = createCatalogState();
    setCatalogLoading();

    const [oneShotResult, serialResult] = await Promise.allSettled([
      fetchText(ONE_SHOT_CATALOG_URL, "読み切り作品一覧"),
      fetchText(SERIAL_CATALOG_URL, "連載作品一覧"),
    ]);

    if (oneShotResult.status === "fulfilled") {
      try {
        state.catalogs["one-shot"] = {
          ...buildOneShotCatalog(oneShotResult.value),
          ready: true,
          error: null,
        };
      } catch (error) {
        state.catalogs["one-shot"].error = error;
      }
    } else {
      state.catalogs["one-shot"].error = oneShotResult.reason;
    }

    const expectedGenres = state.catalogs["one-shot"].ready
      ? state.catalogs["one-shot"].genreNames
      : null;
    if (serialResult.status === "fulfilled") {
      try {
        state.catalogs.serial = {
          ...buildSerialCatalog(serialResult.value, expectedGenres),
          ready: true,
          error: null,
        };
      } catch (error) {
        state.catalogs.serial.error = error;
      }
    } else {
      state.catalogs.serial.error = serialResult.reason;
    }

    state.genreNames = state.catalogs["one-shot"].ready
      ? state.catalogs["one-shot"].genreNames
      : state.catalogs.serial.ready
        ? state.catalogs.serial.genreNames
        : [];
    state.catalogsLoaded = true;

    updateArchiveCounts();
    const route = readRoute();
    const initialCatalogType = route.type === "series" || route.type === "episode"
      ? "serial"
      : normalizeCatalogType(history.state?.catalogType);
    switchCatalog(initialCatalogType, {
      updateHistory: false,
      focusTab: false,
    });
    routeToCurrentLocation();
  }

  async function fetchText(url, label, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`${label}を取得できませんでした（HTTP ${response.status}）`);
    }
    return response.text();
  }

  function setCatalogLoading() {
    elements.catalogStatus.className = "catalog-status";
    elements.catalogStatus.textContent = "作品情報を読み込んでいます…";
    elements.workList.hidden = false;
    elements.workList.replaceChildren();
    elements.catalogEmpty.hidden = true;
  }

  function buildOneShotCatalog(csvText) {
    const table = parseCsv(csvText);
    if (table.length < 2) {
      throw new Error("読み切りCSVに作品情報がありません。");
    }

    const headers = validateHeaders(table[0], ONE_SHOT_META_COLUMNS, "読み切りCSV");
    const genreNames = headers.slice(ONE_SHOT_META_COLUMNS.length);
    if (genreNames.length === 0) {
      throw new Error("読み切りCSVにジャンル列がありません。");
    }

    const allItems = [];
    const itemMap = new Map();
    table.slice(1).forEach((fields, rowIndex) => {
      const row = makeRow(headers, fields, rowIndex + 2, "読み切りCSV");
      const filename = row["ファイル名"];
      const title = row["タイトル"];
      const duplicateOf = row["重複元ファイル"];

      if (!filename || !title) {
        throw new Error(
          `読み切りCSV ${rowIndex + 2}行目のファイル名またはタイトルが空です。`,
        );
      }
      validateTextFilename(filename, `読み切りCSV ${rowIndex + 2}行目`);
      if (itemMap.has(filename)) {
        throw new Error(`読み切りCSVに同じファイル名があります: ${filename}`);
      }

      const genres = readGenreValues(row, genreNames, rowIndex + 2, "読み切りCSV");
      const item = { filename, title, duplicateOf, genres };
      allItems.push(item);
      itemMap.set(filename, item);
    });

    allItems.forEach((item) => {
      if (item.duplicateOf && !itemMap.has(item.duplicateOf)) {
        throw new Error(`重複元ファイルが作品一覧にありません: ${item.duplicateOf}`);
      }
    });

    const items = allItems
      .filter((item) => !item.duplicateOf)
      .map((item, index) => ({ ...item, displayNumber: index + 1 }));
    return { items, allItems, itemMap, genreNames };
  }

  function buildSerialCatalog(csvText, expectedGenres) {
    const table = parseCsv(csvText);
    if (table.length === 0) {
      throw new Error("連載CSVにヘッダーがありません。");
    }

    const headers = validateHeaders(table[0], SERIAL_META_COLUMNS, "連載CSV");
    const genreNames = headers.slice(SERIAL_META_COLUMNS.length);
    if (genreNames.length === 0) {
      throw new Error("連載CSVにジャンル列がありません。");
    }
    if (expectedGenres && !sameStringArray(genreNames, expectedGenres)) {
      throw new Error("連載CSVのジャンル列が読み切りCSVと一致しません。");
    }

    const items = [];
    const itemMap = new Map();
    table.slice(1).forEach((fields, rowIndex) => {
      const row = makeRow(headers, fields, rowIndex + 2, "連載CSV");
      const seriesId = row["連載ID"];
      const title = row["タイトル"];
      const serialState = row["連載状態"];

      if (!SERIAL_ID_PATTERN.test(seriesId)) {
        throw new Error(`連載CSV ${rowIndex + 2}行目の連載IDが不正です。`);
      }
      if (!title) {
        throw new Error(`連載CSV ${rowIndex + 2}行目のタイトルが空です。`);
      }
      if (!SERIAL_STATES.has(serialState)) {
        throw new Error(`連載CSV ${rowIndex + 2}行目の連載状態が不正です。`);
      }
      if (itemMap.has(seriesId)) {
        throw new Error(`連載CSVに同じ連載IDがあります: ${seriesId}`);
      }

      const genres = readGenreValues(row, genreNames, rowIndex + 2, "連載CSV");
      const item = {
        seriesId,
        title,
        serialState,
        genres,
        displayNumber: rowIndex + 1,
      };
      items.push(item);
      itemMap.set(seriesId, item);
    });

    return { items, allItems: items, itemMap, genreNames };
  }

  function buildEpisodeCatalog(csvText, series) {
    const table = parseCsv(csvText);
    if (table.length < 2) {
      throw new Error(`「${series.title}」に各話情報がありません。`);
    }

    const headers = table[0].map((header) => header.trim());
    if (!sameStringArray(headers, EPISODE_COLUMNS)) {
      throw new Error("episodes.csvの列が規定と一致しません。");
    }

    const episodes = [];
    const episodeMap = new Map();
    const orderValues = new Set();
    const filenames = new Set();
    table.slice(1).forEach((fields, rowIndex) => {
      const row = makeRow(headers, fields, rowIndex + 2, "episodes.csv");
      const episodeId = row["エピソードID"];
      const orderText = row["表示順"];
      const label = row["話数表示"];
      const title = row["各話タイトル"];
      const filename = row["ファイル名"];

      if (!EPISODE_ID_PATTERN.test(episodeId)) {
        throw new Error(`episodes.csv ${rowIndex + 2}行目のIDが不正です。`);
      }
      if (!/^(0|[1-9][0-9]*)$/.test(orderText)) {
        throw new Error(`episodes.csv ${rowIndex + 2}行目の表示順が不正です。`);
      }
      const displayOrder = Number(orderText);
      if (!Number.isSafeInteger(displayOrder)) {
        throw new Error(`episodes.csv ${rowIndex + 2}行目の表示順が大きすぎます。`);
      }
      if (!label) {
        throw new Error(`episodes.csv ${rowIndex + 2}行目の話数表示が空です。`);
      }
      validateTextFilename(filename, `episodes.csv ${rowIndex + 2}行目`);
      if (filename !== `${episodeId}.txt`) {
        throw new Error(
          `episodes.csv ${rowIndex + 2}行目のファイル名は${episodeId}.txtにしてください。`,
        );
      }
      if (episodeMap.has(episodeId)) {
        throw new Error(`episodes.csvに同じエピソードIDがあります: ${episodeId}`);
      }
      if (orderValues.has(displayOrder)) {
        throw new Error(`episodes.csvに同じ表示順があります: ${displayOrder}`);
      }
      if (filenames.has(filename)) {
        throw new Error(`episodes.csvに同じファイル名があります: ${filename}`);
      }

      const episode = { episodeId, displayOrder, label, title, filename };
      episodes.push(episode);
      episodeMap.set(episodeId, episode);
      orderValues.add(displayOrder);
      filenames.add(filename);
    });

    episodes.sort((left, right) => left.displayOrder - right.displayOrder);
    return { episodes, episodeMap };
  }

  function validateHeaders(rawHeaders, metaColumns, label) {
    const headers = rawHeaders.map((header) => header.trim());
    if (new Set(headers).size !== headers.length) {
      throw new Error(`${label}に同じ名前の列が複数あります。`);
    }
    if (!sameStringArray(headers.slice(0, metaColumns.length), metaColumns)) {
      throw new Error(`${label}の先頭列が規定と一致しません。`);
    }
    return headers;
  }

  function makeRow(headers, fields, lineNumber, label) {
    if (fields.length !== headers.length) {
      throw new Error(`${label} ${lineNumber}行目の列数が正しくありません。`);
    }
    return Object.fromEntries(
      headers.map((header, index) => [header, fields[index].trim()]),
    );
  }

  function readGenreValues(row, genreNames, lineNumber, label) {
    const invalidGenre = genreNames.find(
      (genre) => row[genre] !== "0" && row[genre] !== "1",
    );
    if (invalidGenre) {
      throw new Error(
        `${label} ${lineNumber}行目の「${invalidGenre}」は0または1ではありません。`,
      );
    }
    const genres = genreNames.filter((genre) => row[genre] === "1");
    if (genres.length === 0) {
      throw new Error(`${label} ${lineNumber}行目にジャンルが設定されていません。`);
    }
    return genres;
  }

  function validateTextFilename(filename, label) {
    if (
      !filename ||
      !filename.endsWith(".txt") ||
      filename === ".txt" ||
      filename.includes("/") ||
      filename.includes("\\") ||
      filename.includes("%") ||
      filename === "." ||
      filename === ".."
    ) {
      throw new Error(`${label}の本文ファイル名が不正です。`);
    }
  }

  function updateArchiveCounts() {
    const oneShotCatalog = state.catalogs["one-shot"];
    const serialCatalog = state.catalogs.serial;
    const oneShotCount = oneShotCatalog.ready ? oneShotCatalog.items.length : null;
    const serialCount = serialCatalog.ready ? serialCatalog.items.length : null;
    const total = (oneShotCount || 0) + (serialCount || 0);

    elements.oneShotCount.textContent = oneShotCount === null ? "!" : String(oneShotCount);
    elements.serialCount.textContent = serialCount === null ? "!" : String(serialCount);
    elements.workTotal.textContent = oneShotCount === null && serialCount === null
      ? "--"
      : String(total);
    elements.genreTotal.textContent = state.genreNames.length
      ? String(state.genreNames.length)
      : "--";
  }

  function switchCatalog(catalogType, options = {}) {
    const normalizedType = normalizeCatalogType(catalogType);
    state.activeCatalogType = normalizedType;
    const filter = getActiveFilter();
    elements.titleSearch.value = filter.query;
    elements.titleSearch.placeholder = normalizedType === "serial"
      ? "連載作品名を入力"
      : "読み切りの作品名を入力";
    elements.catalogTitle.textContent = normalizedType === "serial"
      ? "連載作品"
      : "読み切り作品";

    elements.catalogTabs.querySelectorAll('[role="tab"]').forEach((tab) => {
      const selected = tab.dataset.catalogType === normalizedType;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    const selectedTab = elements.catalogTabs.querySelector(
      `[data-catalog-type="${normalizedType}"]`,
    );
    elements.catalogPanel.setAttribute("aria-labelledby", selectedTab.id);

    renderGenreFilters();
    renderCatalog();

    if (options.updateHistory !== false && elements.body.dataset.view === "portal") {
      const historyData = isPlainObject(history.state) ? history.state : {};
      const focusPrefix = normalizedType === "serial" ? "serial:" : "one-shot:";
      const lastFocusedWork = typeof historyData.lastFocusedWork === "string" &&
        historyData.lastFocusedWork.startsWith(focusPrefix)
        ? historyData.lastFocusedWork
        : null;
      history.replaceState(
        {
          ...historyData,
          view: "portal",
          catalogType: normalizedType,
          lastFocusedWork,
        },
        "",
        location.href,
      );
    }
    if (options.focusTab) {
      selectedTab.focus();
    }
  }

  function handleCatalogTabKeydown(event) {
    const currentTab = event.target.closest('button[role="tab"]');
    if (!currentTab) {
      return;
    }

    const currentIndex = CATALOG_TYPES.indexOf(currentTab.dataset.catalogType);
    let nextIndex = null;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % CATALOG_TYPES.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + CATALOG_TYPES.length) % CATALOG_TYPES.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = CATALOG_TYPES.length - 1;
    }
    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    switchCatalog(CATALOG_TYPES[nextIndex], { focusTab: true });
  }

  function renderGenreFilters() {
    const catalog = getActiveCatalog();
    const items = catalog.ready ? catalog.items : [];
    const activeGenres = getActiveFilter().activeGenres;
    const fragment = document.createDocumentFragment();

    state.genreNames.forEach((genre) => {
      const countValue = items.filter((item) => item.genres.includes(genre)).length;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.genre = genre;
      button.setAttribute("aria-pressed", String(activeGenres.has(genre)));
      button.append(document.createTextNode(genre));

      const count = document.createElement("span");
      count.textContent = String(countValue);
      count.setAttribute("aria-label", `${countValue}作品`);
      button.append(count);
      fragment.append(button);
    });
    elements.genreFilterList.replaceChildren(fragment);
  }

  function renderCatalog() {
    if (!state.catalogsLoaded) {
      setCatalogLoading();
      return;
    }

    const catalog = getActiveCatalog();
    if (!catalog.ready) {
      renderCatalogError(catalog.error);
      updateFilterControls();
      return;
    }

    const filter = getActiveFilter();
    const query = normalizeForSearch(filter.query);
    const matchingItems = catalog.items.filter((item) => {
      const searchableId = state.activeCatalogType === "serial"
        ? item.seriesId
        : item.filename;
      const matchesQuery =
        !query ||
        normalizeForSearch(item.title).includes(query) ||
        normalizeForSearch(searchableId).includes(query);
      const matchesGenres = [...filter.activeGenres].every((genre) =>
        item.genres.includes(genre),
      );
      return matchesQuery && matchesGenres;
    });

    const fragment = document.createDocumentFragment();
    matchingItems.forEach((item) => {
      fragment.append(
        state.activeCatalogType === "serial"
          ? createSeriesCard(item)
          : createOneShotCard(item),
      );
    });
    elements.workList.replaceChildren(fragment);
    elements.workList.hidden = matchingItems.length === 0;
    elements.catalogEmpty.hidden = matchingItems.length !== 0;

    updateCatalogEmpty(catalog.items.length, matchingItems.length);
    updateCatalogStatus(matchingItems.length, catalog.items.length);
    updateFilterControls();
  }

  function renderCatalogError(error) {
    elements.catalogStatus.className = "catalog-status catalog-status--error";
    elements.catalogStatus.textContent = state.activeCatalogType === "serial"
      ? "連載作品情報を読み込めませんでした。"
      : "読み切り作品情報を読み込めませんでした。";
    elements.catalogEmpty.hidden = true;
    elements.workList.hidden = false;

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
    retryButton.addEventListener("click", loadCatalogs, { once: true });
    errorBox.append(title, detail, retryButton);
    elements.workList.replaceChildren(errorBox);
  }

  function createOneShotCard(item) {
    const link = createWorkCardShell(
      `No. ${String(item.displayNumber).padStart(3, "0")}`,
      item.title,
      item.genres,
    );
    link.setAttribute("href", buildOneShotHash(item.filename));
    link.dataset.filename = item.filename;
    link.dataset.focusKey = `one-shot:${item.filename}`;
    return wrapListItem(link);
  }

  function createSeriesCard(item) {
    const link = document.createElement("a");
    link.className = "novel-card";
    link.setAttribute("href", buildSeriesHash(item.seriesId));
    link.dataset.seriesId = item.seriesId;
    link.dataset.focusKey = `serial:${item.seriesId}`;

    const meta = document.createElement("span");
    meta.className = "novel-card__meta";
    const number = document.createElement("span");
    number.className = "novel-card__number";
    number.setAttribute("aria-hidden", "true");
    number.textContent = `Serial ${String(item.displayNumber).padStart(3, "0")}`;
    const serialState = document.createElement("span");
    serialState.className = "series-state";
    serialState.textContent = item.serialState;
    meta.append(number, serialState);

    const title = document.createElement("span");
    title.className = "novel-card__title";
    title.textContent = item.title;
    const callToAction = document.createElement("span");
    callToAction.className = "novel-card__cta";
    callToAction.textContent = "目次を開く";
    link.append(meta, title, createTagList(item.genres), callToAction);
    return wrapListItem(link);
  }

  function createWorkCardShell(numberText, titleText, genres) {
    const link = document.createElement("a");
    link.className = "novel-card";
    const number = document.createElement("span");
    number.className = "novel-card__number";
    number.setAttribute("aria-hidden", "true");
    number.textContent = numberText;
    const title = document.createElement("span");
    title.className = "novel-card__title";
    title.textContent = titleText;
    link.append(number, title, createTagList(genres));
    return link;
  }

  function wrapListItem(content) {
    const item = document.createElement("div");
    item.className = "novel-card-item";
    item.setAttribute("role", "listitem");
    item.append(content);
    return item;
  }

  function createTagList(genres) {
    const list = document.createElement("span");
    list.className = "tag-list";
    list.append(...createGenreTags(genres));
    return list;
  }

  function updateCatalogEmpty(totalCount, matchingCount) {
    const filter = getActiveFilter();
    const hasFilters = Boolean(filter.query.trim()) || filter.activeGenres.size > 0;
    if (state.activeCatalogType === "serial" && totalCount === 0 && !hasFilters) {
      elements.catalogEmptyTitle.textContent = "連載作品はまだありません";
      elements.catalogEmptyMessage.textContent =
        "連載作品を追加すると、シリーズごとにこの棚へ表示されます。";
      elements.catalogEmptyButton.hidden = true;
      return;
    }

    elements.catalogEmptyTitle.textContent = matchingCount === 0
      ? "該当する作品がありません"
      : "";
    elements.catalogEmptyMessage.textContent =
      "検索語や選択中のジャンルを変えてみてください。";
    elements.catalogEmptyButton.hidden = !hasFilters;
  }

  function updateCatalogStatus(matchingCount, totalCount) {
    const filter = getActiveFilter();
    const hasFilters = Boolean(filter.query.trim()) || filter.activeGenres.size > 0;
    const count = document.createElement("strong");
    count.textContent = String(matchingCount);
    const suffix = hasFilters ? ` / ${totalCount}作品を表示` : "作品を収録";
    elements.catalogStatus.className = "catalog-status";
    elements.catalogStatus.replaceChildren(count, document.createTextNode(suffix));
  }

  function updateFilterControls() {
    const activeGenres = getActiveFilter().activeGenres;
    elements.genreFilterList.querySelectorAll("button[data-genre]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(activeGenres.has(button.dataset.genre)),
      );
    });
    const selectedCount = activeGenres.size;
    elements.selectedGenreCount.textContent = selectedCount
      ? `${selectedCount}件を選択`
      : "未選択";
    elements.clearFilters.hidden =
      !getActiveFilter().query.trim() && selectedCount === 0;
  }

  function clearAllFilters() {
    const filter = getActiveFilter();
    filter.query = "";
    filter.activeGenres.clear();
    elements.titleSearch.value = "";
    renderCatalog();
    elements.titleSearch.focus();
  }

  function handleWorkLinkClick(event) {
    const link = event.target.closest("a[data-filename], a[data-series-id]");
    if (!link || !shouldHandleLinkClick(event)) {
      return;
    }

    event.preventDefault();
    savePortalHistory(link.dataset.focusKey);
    if (link.dataset.seriesId) {
      history.pushState(
        {
          view: "series",
          catalogType: "serial",
          fromPortal: true,
          seriesFromPortal: true,
          seriesId: link.dataset.seriesId,
        },
        "",
        buildSeriesHash(link.dataset.seriesId),
      );
    } else {
      history.pushState(
        {
          view: "reader",
          readerKind: "one-shot",
          catalogType: "one-shot",
          fromPortal: true,
          filename: link.dataset.filename,
        },
        "",
        buildOneShotHash(link.dataset.filename),
      );
    }
    routeToCurrentLocation();
  }

  function savePortalHistory(focusKey) {
    const historyData = isPlainObject(history.state) ? history.state : {};
    history.replaceState(
      {
        ...historyData,
        view: "portal",
        catalogType: state.activeCatalogType,
        portalScrollY: window.scrollY,
        lastFocusedWork: focusKey,
      },
      "",
      location.href,
    );
  }

  function routeToCurrentLocation() {
    if (!state.catalogsLoaded) {
      return;
    }

    const route = readRoute();
    if (route.type === "portal") {
      showPortal();
      return;
    }
    if (route.type === "invalid") {
      showMissingContent(
        "URLの作品情報を読み取れませんでした。",
        route.catalogType || "one-shot",
      );
      return;
    }
    if (route.type === "one-shot") {
      const catalog = state.catalogs["one-shot"];
      if (!catalog.ready) {
        showCatalogRouteError("one-shot", catalog.error);
        return;
      }
      const item = catalog.itemMap.get(route.filename);
      if (!item) {
        showMissingContent(
          "指定された読み切り作品は、この作品棚に登録されていません。",
          "one-shot",
        );
        return;
      }
      showOneShot(item);
      return;
    }

    const catalog = state.catalogs.serial;
    if (!catalog.ready) {
      showCatalogRouteError("serial", catalog.error);
      return;
    }
    const series = catalog.itemMap.get(route.seriesId);
    if (!series) {
      showMissingContent(
        "指定された連載作品は、この作品棚に登録されていません。",
        "serial",
      );
      return;
    }
    if (route.type === "series") {
      showSeries(series);
    } else {
      showEpisode(series, route.episodeId);
    }
  }

  function showPortal(options = {}) {
    cancelCurrentRequest();
    beginScrollRestore();
    const returningToPortal = elements.body.dataset.view !== "portal";
    state.currentReading = null;
    state.currentRouteKey = null;
    elements.readerView.hidden = true;
    elements.seriesView.hidden = true;
    elements.portalView.hidden = false;
    elements.body.dataset.view = "portal";
    elements.readingProgressBar.style.width = "0%";
    document.title = BASE_TITLE;

    const historyData = isPlainObject(history.state) ? history.state : {};
    const catalogType = normalizeCatalogType(
      options.catalogType || historyData.catalogType || state.activeCatalogType,
    );
    switchCatalog(catalogType, { updateHistory: false, focusTab: false });

    if (options.restorePosition === false) {
      completeScrollRestore(0, () => {
        if (options.focusPortalTitle) {
          elements.portalTitle.focus({ preventScroll: true });
        }
      });
      return;
    }

    const scrollY = Number.isFinite(historyData.portalScrollY)
      ? historyData.portalScrollY
      : 0;
    completeScrollRestore(scrollY, () => {
      let restoredWorkFocus = false;
      if (historyData.lastFocusedWork) {
        const card = [...elements.workList.querySelectorAll("a[data-focus-key]")].find(
          (candidate) => candidate.dataset.focusKey === historyData.lastFocusedWork,
        );
        if (card) {
          card.focus({ preventScroll: true });
          restoredWorkFocus = true;
        }
      }
      if (!restoredWorkFocus && returningToPortal) {
        elements.catalogTabs.querySelector(
          `[data-catalog-type="${catalogType}"]`,
        )?.focus({ preventScroll: true });
      }
    });
  }

  async function showSeries(series, options = {}) {
    cancelCurrentRequest();
    beginScrollRestore();
    const routeToken = ++state.routeToken;
    state.currentRouteKey = `series:${series.seriesId}`;
    state.currentReading = null;
    state.activeCatalogType = "serial";

    elements.portalView.hidden = true;
    elements.readerView.hidden = true;
    elements.seriesView.hidden = false;
    elements.body.dataset.view = "series";
    elements.seriesTitle.textContent = series.title;
    elements.seriesState.textContent = series.serialState;
    elements.seriesTags.replaceChildren(...createGenreTags(series.genres));
    elements.seriesSummary.hidden = true;
    elements.seriesActions.hidden = true;
    elements.episodeCount.textContent = "";
    elements.episodeList.hidden = true;
    elements.episodeList.replaceChildren();
    setSeriesLoading();
    document.title = `${series.title} | Cold Print`;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const historyData = isPlainObject(history.state) ? history.state : {};
    if (!Number.isFinite(historyData.seriesScrollY)) {
      requestAnimationFrame(() => elements.seriesTitle.focus({ preventScroll: true }));
    }

    const controller = new AbortController();
    state.requestController = controller;
    try {
      const manifest = await loadSeriesManifest(series, {
        signal: controller.signal,
        forceReload: options.forceReload,
      });
      if (routeToken !== state.routeToken || state.currentRouteKey !== `series:${series.seriesId}`) {
        return;
      }
      renderSeriesEpisodes(series, manifest);
      restoreSeriesPosition(series);
    } catch (error) {
      if (error.name !== "AbortError" && routeToken === state.routeToken) {
        showSeriesError(series, error);
      }
    } finally {
      if (state.requestController === controller) {
        state.requestController = null;
      }
    }
  }

  function setSeriesLoading() {
    elements.seriesStatus.hidden = false;
    elements.seriesStatus.className = "reader-status";
    elements.seriesStatus.textContent = "各話情報を読み込んでいます…";
  }

  async function loadSeriesManifest(series, options = {}) {
    if (!options.forceReload && state.seriesCache.has(series.seriesId)) {
      return state.seriesCache.get(series.seriesId);
    }

    const seriesDirectory = new URL(
      `${encodeURIComponent(series.seriesId)}/`,
      SERIAL_DIRECTORY_URL,
    );
    const episodesUrl = new URL("./episodes.csv", seriesDirectory);
    const csvText = await fetchText(episodesUrl, "各話一覧", {
      signal: options.signal,
    });
    const manifest = buildEpisodeCatalog(csvText, series);
    state.seriesCache.set(series.seriesId, manifest);
    return manifest;
  }

  function renderSeriesEpisodes(series, manifest) {
    const fragment = document.createDocumentFragment();
    manifest.episodes.forEach((episode) => {
      const item = document.createElement("div");
      item.className = "episode-list-item";
      item.setAttribute("role", "listitem");
      const link = document.createElement("a");
      link.className = "episode-link";
      link.href = buildEpisodeHash(series.seriesId, episode.episodeId);
      link.dataset.seriesId = series.seriesId;
      link.dataset.episodeId = episode.episodeId;
      link.dataset.seriesFocusKey = `list:${episode.episodeId}`;

      const number = document.createElement("span");
      number.className = "episode-link__number";
      number.textContent = episode.label;
      const title = document.createElement("span");
      title.className = "episode-link__title";
      title.textContent = episode.title || "本文を読む";
      const arrow = document.createElement("span");
      arrow.className = "episode-link__arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";
      link.append(number, title, arrow);
      item.append(link);
      fragment.append(item);
    });

    const firstEpisode = manifest.episodes[0];
    const latestEpisode = manifest.episodes.at(-1);
    configureEpisodeLink(elements.firstEpisodeLink, series, firstEpisode);
    configureEpisodeLink(elements.latestEpisodeLink, series, latestEpisode);
    elements.latestEpisodeLink.hidden = firstEpisode === latestEpisode;
    elements.seriesSummary.textContent = `${manifest.episodes.length}話を収録・${series.serialState}`;
    elements.seriesSummary.hidden = false;
    elements.seriesActions.hidden = false;
    elements.episodeCount.textContent = `全${manifest.episodes.length}話`;
    elements.seriesStatus.hidden = true;
    elements.episodeList.replaceChildren(fragment);
    elements.episodeList.hidden = false;
  }

  function configureEpisodeLink(link, series, episode) {
    link.href = buildEpisodeHash(series.seriesId, episode.episodeId);
    link.dataset.seriesId = series.seriesId;
    link.dataset.episodeId = episode.episodeId;
  }

  function restoreSeriesPosition(series) {
    const historyData = isPlainObject(history.state) ? history.state : {};
    const pendingFocus = state.pendingSeriesFocus;
    const hasPendingFocus = pendingFocus?.seriesId === series.seriesId;
    const focusKey = hasPendingFocus
      ? `list:${pendingFocus.episodeId}`
      : historyData.seriesFocusKey;
    const fallbackEpisodeId = hasPendingFocus
      ? pendingFocus.episodeId
      : historyData.lastFocusedEpisode;
    state.pendingSeriesFocus = null;
    const hasSavedPosition =
      historyData.view === "series" && Number.isFinite(historyData.seriesScrollY);
    completeScrollRestore(hasSavedPosition ? historyData.seriesScrollY : 0, () => {
      if (focusKey || fallbackEpisodeId) {
        const controls = [
          ...elements.seriesView.querySelectorAll("[data-series-focus-key]"),
        ];
        const link = controls.find(
          (candidate) => candidate.dataset.seriesFocusKey === focusKey,
        ) || controls.find(
          (candidate) => candidate.dataset.episodeId === fallbackEpisodeId,
        );
        if (link) {
          link.focus({ preventScroll: true });
          if (hasPendingFocus) {
            link.scrollIntoView({ block: "nearest", inline: "nearest" });
          }
        } else if (hasSavedPosition) {
          elements.seriesTitle.focus({ preventScroll: true });
        }
      } else if (hasSavedPosition) {
        elements.seriesTitle.focus({ preventScroll: true });
      }
    });
  }

  function showSeriesError(series, error) {
    elements.seriesStatus.hidden = false;
    elements.seriesStatus.className = "reader-status reader-status--error";
    const title = document.createElement("p");
    title.className = "reader-status__title";
    title.textContent = "目次を開けませんでした";
    const detail = document.createElement("p");
    detail.className = "reader-status__detail";
    detail.textContent = readableErrorMessage(error);
    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.className = "secondary-button";
    retryButton.textContent = "もう一度読み込む";
    retryButton.addEventListener(
      "click",
      () => showSeries(series, { forceReload: true }),
      { once: true },
    );
    elements.seriesStatus.replaceChildren(title, detail, retryButton);
    completeScrollRestore(0, () => retryButton.focus({ preventScroll: true }));
  }

  function handleSeriesViewClick(event) {
    const link = event.target.closest("a[data-series-id][data-episode-id]");
    if (!link || !shouldHandleLinkClick(event)) {
      return;
    }
    event.preventDefault();
    navigateToEpisode(link.dataset.seriesId, link.dataset.episodeId, {
      source: "series",
      seriesFocusKey: link.dataset.seriesFocusKey,
    });
  }

  function navigateToEpisode(seriesId, episodeId, options = {}) {
    const historyData = isPlainObject(history.state) ? history.state : {};
    let seriesReturnDepth = 0;
    if (options.source === "series") {
      seriesReturnDepth = 1;
      history.replaceState(
        {
          ...historyData,
          view: "series",
          catalogType: "serial",
          seriesId,
          seriesScrollY: window.scrollY,
          lastFocusedEpisode: episodeId,
          seriesFocusKey: options.seriesFocusKey,
        },
        "",
        location.href,
      );
    } else if (options.source === "reader") {
      if (Number.isSafeInteger(historyData.seriesReturnDepth)) {
        seriesReturnDepth = historyData.seriesReturnDepth + 1;
      }
      history.replaceState(
        {
          ...historyData,
          readerScrollY: window.scrollY,
          readerFocusKey: options.returnFocusKey || historyData.readerFocusKey,
        },
        "",
        location.href,
      );
    }

    history.pushState(
      {
        view: "reader",
        readerKind: "episode",
        catalogType: "serial",
        fromPortal: Boolean(historyData.fromPortal),
        seriesId,
        episodeId,
        ...(seriesReturnDepth > 0 ? { seriesReturnDepth } : {}),
      },
      "",
      buildEpisodeHash(seriesId, episodeId),
    );
    routeToCurrentLocation();
  }

  function returnFromSeriesToPortal() {
    const historyData = isPlainObject(history.state) ? history.state : {};
    if (historyData.view === "series" && historyData.seriesFromPortal) {
      flushHistorySnapshot();
      history.back();
      return;
    }
    replaceWithPortal("serial");
  }

  async function showOneShot(item, options = {}) {
    cancelCurrentRequest();
    const routeToken = ++state.routeToken;
    const routeKey = `one-shot:${item.filename}`;
    state.currentRouteKey = routeKey;
    state.currentReading = { kind: "one-shot", item };
    prepareReader({
      title: item.title,
      kicker: "Now reading",
      seriesTitle: "",
      genres: item.genres,
      backLabel: "作品一覧へ",
      navLabel: "Cold Print",
      documentTitle: `${item.title} | Cold Print`,
      episodeMode: false,
    });

    const cacheKey = routeKey;
    if (!options.forceReload && state.textCache.has(cacheKey)) {
      renderReaderText(state.textCache.get(cacheKey), { episodeMode: false });
      restoreReaderPosition();
      return;
    }

    const controller = new AbortController();
    state.requestController = controller;
    try {
      const novelUrl = new URL(encodeURIComponent(item.filename), ONE_SHOT_DIRECTORY_URL);
      const rawText = await fetchText(novelUrl, "本文", { signal: controller.signal });
      if (routeToken !== state.routeToken || state.currentRouteKey !== routeKey) {
        return;
      }
      const text = normalizeNovelText(rawText);
      state.textCache.set(cacheKey, text);
      renderReaderText(text, { episodeMode: false });
      restoreReaderPosition();
    } catch (error) {
      if (error.name !== "AbortError" && routeToken === state.routeToken) {
        showReaderError(error, () => showOneShot(item, { forceReload: true }));
      }
    } finally {
      if (state.requestController === controller) {
        state.requestController = null;
      }
    }
  }

  async function showEpisode(series, episodeId, options = {}) {
    cancelCurrentRequest();
    const routeToken = ++state.routeToken;
    const routeKey = `episode:${series.seriesId}:${episodeId}`;
    state.currentRouteKey = routeKey;
    state.currentReading = { kind: "episode", series, episodeId };
    prepareReader({
      title: "各話情報を読み込んでいます",
      kicker: "Serial episode",
      seriesTitle: series.title,
      genres: series.genres,
      backLabel: "目次へ",
      navLabel: series.title,
      documentTitle: `${series.title} | Cold Print`,
      episodeMode: true,
    });

    const controller = new AbortController();
    state.requestController = controller;
    try {
      const manifest = await loadSeriesManifest(series, {
        signal: controller.signal,
        forceReload: options.forceManifest,
      });
      if (routeToken !== state.routeToken || state.currentRouteKey !== routeKey) {
        return;
      }

      const episode = manifest.episodeMap.get(episodeId);
      if (!episode) {
        showMissingContent(
          "指定された話は、この連載作品に登録されていません。",
          "serial",
        );
        return;
      }
      state.currentReading = { kind: "episode", series, episode, manifest };
      updateEpisodeReaderHeader(series, episode, manifest);

      const cacheKey = routeKey;
      if (!options.forceText && state.textCache.has(cacheKey)) {
        renderReaderText(state.textCache.get(cacheKey), { episodeMode: true });
        restoreReaderPosition();
        return;
      }

      const seriesDirectory = new URL(
        `${encodeURIComponent(series.seriesId)}/`,
        SERIAL_DIRECTORY_URL,
      );
      const episodeDirectory = new URL("./episodes/", seriesDirectory);
      const episodeUrl = new URL(encodeURIComponent(episode.filename), episodeDirectory);
      const rawText = await fetchText(episodeUrl, "本文", { signal: controller.signal });
      if (routeToken !== state.routeToken || state.currentRouteKey !== routeKey) {
        return;
      }
      const text = normalizeNovelText(rawText);
      state.textCache.set(cacheKey, text);
      renderReaderText(text, { episodeMode: true });
      restoreReaderPosition();
    } catch (error) {
      if (error.name !== "AbortError" && routeToken === state.routeToken) {
        showReaderError(error, () =>
          showEpisode(series, episodeId, {
            forceManifest: !state.seriesCache.has(series.seriesId),
            forceText: true,
          }),
        );
      }
    } finally {
      if (state.requestController === controller) {
        state.requestController = null;
      }
    }
  }

  function prepareReader(options) {
    beginScrollRestore();
    elements.portalView.hidden = true;
    elements.seriesView.hidden = true;
    elements.readerView.hidden = false;
    elements.body.dataset.view = "reader";
    elements.readerKicker.textContent = options.kicker;
    elements.readerSeriesTitle.textContent = options.seriesTitle;
    elements.readerSeriesTitle.hidden = !options.seriesTitle;
    elements.readerTitle.textContent = options.title;
    elements.readerTags.replaceChildren(...createGenreTags(options.genres));
    elements.readerBackLabel.textContent = options.backLabel;
    elements.readerNavLabel.textContent = options.navLabel;
    elements.readerBody.hidden = true;
    elements.readerBody.textContent = "";
    elements.readerFooter.hidden = true;
    elements.oneShotFooterActions.hidden = options.episodeMode;
    elements.episodeNavigationTop.hidden = true;
    elements.episodeNavigationBottom.hidden = true;
    elements.readerStatus.hidden = false;
    elements.readerStatus.className = "reader-status";
    elements.readerStatus.textContent = "本文を読み込んでいます…";
    elements.readerArticle.setAttribute("aria-busy", "true");
    document.title = options.documentTitle;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const historyData = isPlainObject(history.state) ? history.state : {};
    if (!Number.isFinite(historyData.readerScrollY)) {
      requestAnimationFrame(() => elements.readerTitle.focus({ preventScroll: true }));
    }
    requestProgressUpdate();
  }

  function updateEpisodeReaderHeader(series, episode, manifest) {
    const heading = formatEpisodeTitle(episode);
    elements.readerTitle.textContent = heading;
    elements.readerSeriesTitle.textContent = series.title;
    elements.readerSeriesTitle.hidden = false;
    document.title = `${heading} | ${series.title} | Cold Print`;
    renderEpisodeNavigation(elements.episodeNavigationTop, series, episode, manifest);
    renderEpisodeNavigation(elements.episodeNavigationBottom, series, episode, manifest);
    elements.episodeNavigationTop.hidden = false;
  }

  function renderEpisodeNavigation(container, series, episode, manifest) {
    const index = manifest.episodes.findIndex(
      (candidate) => candidate.episodeId === episode.episodeId,
    );
    const previousEpisode = index > 0 ? manifest.episodes[index - 1] : null;
    const nextEpisode = index < manifest.episodes.length - 1
      ? manifest.episodes[index + 1]
      : null;
    container.replaceChildren(
      previousEpisode
        ? createEpisodeNavigationLink(
          series,
          previousEpisode,
          "previous",
          `${container.id}:previous`,
        )
        : createEpisodeNavigationPlaceholder("最初の話です"),
      createTableOfContentsButton(series.seriesId, `${container.id}:contents`),
      nextEpisode
        ? createEpisodeNavigationLink(
          series,
          nextEpisode,
          "next",
          `${container.id}:next`,
        )
        : createEpisodeNavigationPlaceholder("最新の話です"),
    );
  }

  function createEpisodeNavigationLink(series, episode, direction, focusKey) {
    const link = document.createElement("a");
    link.className = `episode-navigation__link episode-navigation__link--${direction}`;
    link.href = buildEpisodeHash(series.seriesId, episode.episodeId);
    link.dataset.seriesId = series.seriesId;
    link.dataset.episodeId = episode.episodeId;
    link.dataset.episodeNavigation = direction;
    link.dataset.readerFocusKey = focusKey;
    const directionText = document.createElement("span");
    directionText.className = "episode-navigation__direction";
    directionText.textContent = direction === "previous" ? "← 前の話" : "次の話 →";
    const title = document.createElement("span");
    title.className = "episode-navigation__title";
    title.textContent = formatEpisodeTitle(episode);
    link.append(directionText, title);
    return link;
  }

  function createEpisodeNavigationPlaceholder(message) {
    const placeholder = document.createElement("span");
    placeholder.className = "episode-navigation__placeholder";
    placeholder.setAttribute("aria-disabled", "true");
    placeholder.textContent = message;
    return placeholder;
  }

  function createTableOfContentsButton(seriesId, focusKey) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "episode-navigation__toc";
    button.dataset.action = "series-contents";
    button.dataset.seriesId = seriesId;
    button.dataset.readerFocusKey = focusKey;
    button.textContent = "目次へ";
    return button;
  }

  function renderReaderText(text, options) {
    elements.readerBody.textContent = text;
    elements.readerBody.hidden = false;
    elements.readerStatus.hidden = true;
    elements.readerFooter.hidden = false;
    elements.oneShotFooterActions.hidden = options.episodeMode;
    elements.episodeNavigationBottom.hidden = !options.episodeMode;
    elements.readerArticle.setAttribute("aria-busy", "false");
    requestProgressUpdate();
  }

  function restoreReaderPosition() {
    const historyData = isPlainObject(history.state) ? history.state : {};
    const hasSavedPosition =
      historyData.view === "reader" && Number.isFinite(historyData.readerScrollY);
    completeScrollRestore(hasSavedPosition ? historyData.readerScrollY : 0, () => {
      if (!historyData.readerFocusKey) {
        if (hasSavedPosition) {
          elements.readerTitle.focus({ preventScroll: true });
        }
        return;
      }
      const control = [
        ...elements.readerView.querySelectorAll("[data-reader-focus-key]"),
      ].find(
        (candidate) => candidate.dataset.readerFocusKey === historyData.readerFocusKey,
      );
      (control || elements.readerTitle).focus({ preventScroll: true });
    });
  }

  function showReaderError(error, retry) {
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
    retryButton.addEventListener("click", retry, { once: true });
    elements.readerStatus.replaceChildren(title, detail, retryButton);
    completeScrollRestore(0, () => retryButton.focus({ preventScroll: true }));
  }

  function showCatalogRouteError(catalogType, error) {
    cancelCurrentRequest();
    state.currentRouteKey = null;
    state.currentReading = { kind: "catalog-error", catalogType };
    prepareReader({
      title: "作品棚を開けませんでした",
      kicker: "Catalog error",
      seriesTitle: "",
      genres: [],
      backLabel: catalogType === "serial" ? "連載一覧へ" : "作品一覧へ",
      navLabel: "Cold Print",
      documentTitle: "作品棚を開けませんでした | Cold Print",
      episodeMode: false,
    });
    elements.readerArticle.setAttribute("aria-busy", "false");
    elements.readerStatus.hidden = false;
    elements.readerStatus.className = "reader-status reader-status--error";
    const title = document.createElement("p");
    title.className = "reader-status__title";
    title.textContent = catalogType === "serial"
      ? "連載作品情報を読み込めませんでした"
      : "読み切り作品情報を読み込めませんでした";
    const detail = document.createElement("p");
    detail.className = "reader-status__detail";
    detail.textContent = readableErrorMessage(error);
    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.className = "secondary-button";
    retryButton.textContent = "もう一度読み込む";
    retryButton.addEventListener("click", loadCatalogs, { once: true });
    elements.readerStatus.replaceChildren(title, detail, retryButton);
    completeScrollRestore(0, () => retryButton.focus({ preventScroll: true }));
  }

  function showMissingContent(message, catalogType) {
    cancelCurrentRequest();
    state.currentRouteKey = null;
    state.currentReading = { kind: "missing", catalogType };
    prepareReader({
      title: "作品が見つかりません",
      kicker: "Not found",
      seriesTitle: "",
      genres: [],
      backLabel: catalogType === "serial" ? "連載一覧へ" : "作品一覧へ",
      navLabel: "Cold Print",
      documentTitle: "作品が見つかりません | Cold Print",
      episodeMode: false,
    });
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
    completeScrollRestore(0);
  }

  function handleReaderViewClick(event) {
    const episodeLink = event.target.closest(
      "a[data-series-id][data-episode-id]",
    );
    if (episodeLink && shouldHandleLinkClick(event)) {
      event.preventDefault();
      navigateToEpisode(episodeLink.dataset.seriesId, episodeLink.dataset.episodeId, {
        source: "reader",
        returnFocusKey: episodeLink.dataset.readerFocusKey,
      });
      return;
    }

    const contentsButton = event.target.closest('[data-action="series-contents"]');
    if (contentsButton) {
      navigateToSeries(contentsButton.dataset.seriesId, {
        returnFocusKey: contentsButton.dataset.readerFocusKey,
      });
      return;
    }

    if (event.target.closest('[data-action="one-shot-to-portal"]')) {
      const button = event.target.closest('[data-action="one-shot-to-portal"]');
      returnFromOneShotToPortal(button.dataset.readerFocusKey);
    }
  }

  function handleReaderBack() {
    if (state.currentReading?.kind === "episode") {
      navigateToSeries(state.currentReading.series.seriesId, {
        returnFocusKey: elements.readerBack.dataset.readerFocusKey,
      });
    } else if (state.currentReading?.kind === "one-shot") {
      returnFromOneShotToPortal(elements.readerBack.dataset.readerFocusKey);
    } else {
      replaceWithPortal(state.currentReading?.catalogType || "one-shot");
    }
  }

  function navigateToSeries(seriesId, options = {}) {
    const historyData = isPlainObject(history.state) ? history.state : {};
    const returnDepth = Number.isSafeInteger(historyData.seriesReturnDepth)
      ? historyData.seriesReturnDepth
      : 0;
    if (historyData.view === "reader" && returnDepth > 0) {
      state.pendingSeriesFocus = returnDepth > 1
        ? { seriesId, episodeId: historyData.episodeId }
        : null;
      history.replaceState(
        {
          ...historyData,
          readerScrollY: window.scrollY,
          readerFocusKey: options.returnFocusKey || historyData.readerFocusKey,
        },
        "",
        location.href,
      );
      history.go(-returnDepth);
      return;
    }
    if (historyData.view === "reader") {
      history.replaceState(
        {
          ...historyData,
          readerScrollY: window.scrollY,
          readerFocusKey: options.returnFocusKey || historyData.readerFocusKey,
        },
        "",
        location.href,
      );
    }
    history.pushState(
      {
        view: "series",
        catalogType: "serial",
        fromPortal: Boolean(historyData.fromPortal),
        seriesFromPortal: false,
        seriesId,
      },
      "",
      buildSeriesHash(seriesId),
    );
    routeToCurrentLocation();
  }

  function returnFromOneShotToPortal(returnFocusKey) {
    const historyData = isPlainObject(history.state) ? history.state : {};
    if (
      historyData.view === "reader" &&
      historyData.readerKind === "one-shot" &&
      historyData.fromPortal
    ) {
      history.replaceState(
        {
          ...historyData,
          readerScrollY: window.scrollY,
          readerFocusKey: returnFocusKey || historyData.readerFocusKey,
        },
        "",
        location.href,
      );
      history.back();
      return;
    }
    replaceWithPortal("one-shot");
  }

  function replaceWithPortal(catalogType) {
    const portalUrl = new URL(location.href);
    portalUrl.hash = "";
    history.replaceState(
      { view: "portal", catalogType, portalScrollY: 0 },
      "",
      `${portalUrl.pathname}${portalUrl.search}`,
    );
    showPortal({
      catalogType,
      focusPortalTitle: true,
      restorePosition: false,
    });
  }

  function cancelCurrentRequest() {
    state.routeToken += 1;
    if (state.requestController) {
      state.requestController.abort();
      state.requestController = null;
    }
  }

  function readRoute() {
    if (!location.hash) {
      return { type: "portal" };
    }
    if (location.hash.startsWith("#novel=")) {
      const encodedFilename = location.hash.slice("#novel=".length);
      if (!encodedFilename) {
        return { type: "invalid", catalogType: "one-shot" };
      }
      try {
        return { type: "one-shot", filename: decodeURIComponent(encodedFilename) };
      } catch {
        return { type: "invalid", catalogType: "one-shot" };
      }
    }
    if (!location.hash.startsWith("#series=")) {
      return { type: "portal" };
    }

    const params = new URLSearchParams(location.hash.slice(1));
    const allowedKeys = new Set(["series", "episode"]);
    if (
      [...params.keys()].some((key) => !allowedKeys.has(key)) ||
      params.getAll("series").length !== 1 ||
      params.getAll("episode").length > 1
    ) {
      return { type: "invalid", catalogType: "serial" };
    }
    const seriesId = params.get("series") || "";
    const episodeId = params.get("episode");
    if (!SERIAL_ID_PATTERN.test(seriesId)) {
      return { type: "invalid", catalogType: "serial" };
    }
    if (episodeId === null) {
      return { type: "series", seriesId };
    }
    if (!EPISODE_ID_PATTERN.test(episodeId)) {
      return { type: "invalid", catalogType: "serial" };
    }
    return { type: "episode", seriesId, episodeId };
  }

  function buildOneShotHash(filename) {
    return `#novel=${encodeURIComponent(filename)}`;
  }

  function buildSeriesHash(seriesId) {
    return `#series=${encodeURIComponent(seriesId)}`;
  }

  function buildEpisodeHash(seriesId, episodeId) {
    return `${buildSeriesHash(seriesId)}&episode=${encodeURIComponent(episodeId)}`;
  }

  function beginScrollRestore() {
    state.scrollRestoreToken += 1;
    state.suppressScrollSnapshot = true;
    if (state.historySnapshotTimer !== null) {
      clearTimeout(state.historySnapshotTimer);
      state.historySnapshotTimer = null;
    }
  }

  function completeScrollRestore(scrollY, restoreFocus) {
    const token = state.scrollRestoreToken;
    requestAnimationFrame(() => {
      if (token !== state.scrollRestoreToken) {
        return;
      }
      window.scrollTo({ top: Math.max(0, scrollY), left: 0, behavior: "auto" });
      restoreFocus?.();
      requestAnimationFrame(() => {
        if (token !== state.scrollRestoreToken) {
          return;
        }
        state.suppressScrollSnapshot = false;
        requestProgressUpdate();
        flushHistorySnapshot();
      });
    });
  }

  function handleWindowScroll() {
    requestProgressUpdate();
    requestHistorySnapshot();
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

  function requestHistorySnapshot() {
    if (state.suppressScrollSnapshot || state.historySnapshotTimer !== null) {
      return;
    }
    const elapsed = performance.now() - state.lastHistorySnapshotTime;
    if (elapsed >= HISTORY_SNAPSHOT_INTERVAL) {
      snapshotCurrentScrollPosition();
      state.lastHistorySnapshotTime = performance.now();
      return;
    }
    state.historySnapshotTimer = window.setTimeout(() => {
      state.historySnapshotTimer = null;
      if (!state.suppressScrollSnapshot) {
        snapshotCurrentScrollPosition();
        state.lastHistorySnapshotTime = performance.now();
      }
    }, HISTORY_SNAPSHOT_INTERVAL - elapsed);
  }

  function flushHistorySnapshot() {
    if (state.historySnapshotTimer !== null) {
      clearTimeout(state.historySnapshotTimer);
      state.historySnapshotTimer = null;
    }
    if (state.suppressScrollSnapshot) {
      return;
    }
    snapshotCurrentScrollPosition();
    state.lastHistorySnapshotTime = performance.now();
  }

  function snapshotCurrentScrollPosition() {
    if (state.suppressScrollSnapshot) {
      return;
    }
    const historyData = isPlainObject(history.state) ? history.state : {};
    const view = elements.body.dataset.view;
    if (historyData.view !== view) {
      return;
    }
    const property = view === "portal"
      ? "portalScrollY"
      : view === "series"
        ? "seriesScrollY"
        : view === "reader"
          ? "readerScrollY"
          : null;
    if (!property) {
      return;
    }
    const scrollY = Math.max(0, window.scrollY);
    if (historyData[property] === scrollY) {
      return;
    }
    try {
      history.replaceState(
        { ...historyData, [property]: scrollY },
        "",
        location.href,
      );
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "SecurityError")) {
        throw error;
      }
    }
  }

  function updateReadingProgress() {
    if (elements.body.dataset.view !== "reader") {
      elements.readingProgressBar.style.width = "0%";
      return;
    }
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollableHeight > 0 ? (scrollTop / scrollableHeight) * 100 : 0;
    elements.readingProgressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  }

  function getActiveCatalog() {
    return state.catalogs[state.activeCatalogType];
  }

  function getActiveFilter() {
    return state.filters[state.activeCatalogType];
  }

  function normalizeCatalogType(value) {
    return value === "serial" ? "serial" : "one-shot";
  }

  function normalizeForSearch(value) {
    return value.normalize("NFKC").toLocaleLowerCase("ja-JP");
  }

  function normalizeNovelText(text) {
    return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  }

  function formatEpisodeTitle(episode) {
    return episode.title ? `${episode.label}　${episode.title}` : episode.label;
  }

  function createGenreTags(genres) {
    return genres.map((genre) => {
      const tag = document.createElement("span");
      tag.className = "genre-tag";
      tag.textContent = genre;
      return tag;
    });
  }

  function readableErrorMessage(error) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return "通信状態とファイルの配置を確認して、もう一度お試しください。";
  }

  function shouldHandleLinkClick(event) {
    return !event.defaultPrevented &&
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey;
  }

  function sameStringArray(left, right) {
    return left.length === right.length &&
      left.every((value, index) => value === right[index]);
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
