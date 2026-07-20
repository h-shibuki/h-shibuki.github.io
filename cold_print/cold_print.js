(() => {
  "use strict";

  const BASE_TITLE = "Cold Print | 参考小説ライブラリ";
  const APPLICATION_SCRIPT_SOURCE =
    document.currentScript?.src ||
    document.querySelector('script[src*="cold_print.js"]')?.src;
  const APPLICATION_SCRIPT_URL = APPLICATION_SCRIPT_SOURCE
    ? new URL(APPLICATION_SCRIPT_SOURCE, document.baseURI)
    : null;
  const ASSET_VERSION = APPLICATION_SCRIPT_URL?.searchParams.get("v") || "";
  const ONE_SHOT_CATALOG_URL = new URL(
    "./novel-sample-genre-inventory.csv",
    document.baseURI,
  );
  const SERIAL_CATALOG_URL = new URL(
    "./serial-novel-inventory.csv",
    document.baseURI,
  );
  const EXTENDED_HTML_DIRECTORY_URL = new URL("./htmls/", document.baseURI);
  const SERIAL_DIRECTORY_URL = new URL("./novels/serials/", document.baseURI);

  const VOTE_COLUMNS = ["Good数", "Bad数"];
  const SUMMARY_MIN_LENGTH = 200;
  const SUMMARY_MAX_LENGTH = 300;
  const ONE_SHOT_META_COLUMNS = [
    "ファイル名",
    "タイトル",
    "概要",
    "サムネイル",
    "重複元ファイル",
    ...VOTE_COLUMNS,
  ];
  const SERIAL_META_COLUMNS = [
    "連載ID",
    "タイトル",
    "概要",
    "サムネイル",
    "連載状態",
    ...VOTE_COLUMNS,
  ];
  const EPISODE_COLUMNS = [
    "エピソードID",
    "表示順",
    "話数表示",
    "各話タイトル",
    "ファイル名",
  ];
  const VOLUME_EPISODE_COLUMNS = [
    ...EPISODE_COLUMNS,
    "巻ID",
    "章ID",
    "章数表示",
    "節表示",
  ];
  const VOLUME_COLUMNS = [
    "巻ID",
    "表示順",
    "巻数表示",
    "巻タイトル",
    "サムネイル",
  ];
  const SERIAL_STATES = new Set(["連載中", "完結", "休載"]);
  const SERIAL_ID_PATTERN = /^serial-[0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const EPISODE_ID_PATTERN = /^ep-[0-9]{3,}$/;
  const VOLUME_ID_PATTERN = /^v[0-9]{2}$/;
  const CHAPTER_ID_PATTERN = /^c[0-9]{2}$/;
  const CATALOG_TYPES = ["one-shot", "serial"];
  const HISTORY_SNAPSHOT_INTERVAL = 200;
  const LEGACY_VOTE_STORAGE_KEY = "cold-print-votes-v1";
  const VOTE_STORAGE_PREFIX = "cold-print-vote-v1:";
  const MAX_BASE_VOTE_COUNT = Number.MAX_SAFE_INTEGER - 1;
  const TITLE_COLLATOR = new Intl.Collator("ja", {
    numeric: true,
    sensitivity: "variant",
  });
  const THUMBNAIL_THEME_BY_GENRE = Object.freeze({
    "冒険活劇": "action",
    "ヒーロー": "action",
    "アクション": "action",
    "バトル": "action",
    "スポーツ": "action",
    "ミステリ": "mystery",
    "サスペンス": "mystery",
    "頭脳戦": "mystery",
    "ホラー": "horror",
    "伝奇": "horror",
    "ロマンス": "romance",
    "ラブコメ": "romance",
    "BL": "romance",
    "ジュブナイル": "fantasy",
    "異世界": "fantasy",
    "ファンタジー": "fantasy",
    "タイムトラベル": "fantasy",
    "SF": "science-fiction",
    "歴史": "historical",
    "会話劇": "slice-of-life",
    "奇妙な味": "horror",
    "日常": "slice-of-life",
    "学園": "slice-of-life",
    "家族ドラマ": "slice-of-life",
    "お仕事": "slice-of-life",
    "音楽": "slice-of-life",
    "ギャグ": "comedy",
    "料理": "comedy",
    "知識チート": "mystery",
  });

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
    voteStatus: document.querySelector("#vote-status"),
    voteNote: document.querySelector("#vote-note"),
    workList: document.querySelector("#work-list"),
    catalogEmpty: document.querySelector("#catalog-empty"),
    catalogEmptyTitle: document.querySelector("#catalog-empty-title"),
    catalogEmptyMessage: document.querySelector("#catalog-empty-message"),
    catalogEmptyButton: document.querySelector(
      '#catalog-empty [data-action="clear-filters"]',
    ),
    seriesView: document.querySelector("#series-view"),
    seriesTitle: document.querySelector("#series-title"),
    seriesThumbnail: document.querySelector("#series-thumbnail"),
    seriesState: document.querySelector("#series-state"),
    seriesTags: document.querySelector("#series-tags"),
    seriesSummary: document.querySelector("#series-summary"),
    seriesActions: document.querySelector("#series-actions"),
    firstEpisodeLink: document.querySelector("#first-episode-link"),
    latestEpisodeLink: document.querySelector("#latest-episode-link"),
    episodeCatalogTitle: document.querySelector("#episode-catalog-title"),
    episodeCount: document.querySelector("#episode-count"),
    seriesStatus: document.querySelector("#series-status"),
    episodeList: document.querySelector("#episode-list"),
    readerView: document.querySelector("#reader-view"),
    readerBack: document.querySelector("#reader-back"),
    readerBackLabel: document.querySelector("#reader-back-label"),
    readerNavLabel: document.querySelector("#reader-nav-label"),
    extendedReader: document.querySelector("#extended-reader"),
    extendedReaderStatus: document.querySelector("#extended-reader-status"),
    extendedEpisodeNavigation: document.querySelector(
      "#extended-episode-navigation",
    ),
    extendedReaderFrame: document.querySelector("#extended-reader-frame"),
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

  const initialVoteState = loadVotes();
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
    votes: initialVoteState.votes,
    voteStorageAvailable: initialVoteState.storageAvailable,
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
    frameScrollWindow: null,
    frameScrollHandler: null,
    frameScrollEndHandler: null,
    currentFrameScrollY: 0,
  };

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  bindEvents();
  updateVoteStorageNote();
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
      const target = elements.body.dataset.view === "reader"
        ? !elements.extendedReader.hidden
          ? elements.extendedReaderFrame
          : elements.readerTitle
        : elements.body.dataset.view === "series"
          ? elements.seriesTitle
          : elements.portalTitle;
      target.focus({ preventScroll: false });
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

    elements.workList.addEventListener("click", handleWorkListClick);
    elements.seriesView.addEventListener("click", handleSeriesViewClick);
    elements.readerView.addEventListener("click", handleReaderViewClick);
    document
      .querySelector('[data-action="series-to-portal"]')
      .addEventListener("click", returnFromSeriesToPortal);
    elements.readerBack.addEventListener("click", handleReaderBack);

    window.addEventListener("popstate", routeToCurrentLocation);
    window.addEventListener("message", handleExtendedReaderMessage);
    window.addEventListener("storage", handleVoteStorageChange);
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
    const response = await fetch(withAssetVersion(url), options);
    if (!response.ok) {
      throw new Error(`${label}を取得できませんでした（HTTP ${response.status}）`);
    }
    return response.text();
  }

  function withAssetVersion(url) {
    const resolvedUrl = new URL(url, document.baseURI);
    if (ASSET_VERSION) {
      resolvedUrl.searchParams.set("v", ASSET_VERSION);
    }
    return resolvedUrl;
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
      const summary = row["概要"];
      const thumbnail = row["サムネイル"];
      const duplicateOf = row["重複元ファイル"];

      if (!filename || !title || !summary) {
        throw new Error(
          `読み切りCSV ${rowIndex + 2}行目のファイル名、タイトルまたは概要が空です。`,
        );
      }
      const summaryLength = Array.from(summary).length;
      if (
        summaryLength < SUMMARY_MIN_LENGTH ||
        summaryLength > SUMMARY_MAX_LENGTH
      ) {
        throw new Error(
          `読み切りCSV ${rowIndex + 2}行目の概要は${SUMMARY_MIN_LENGTH}〜${SUMMARY_MAX_LENGTH}文字にしてください。`,
        );
      }
      validateTextFilename(filename, `読み切りCSV ${rowIndex + 2}行目`);
      validateThumbnailPath(
        thumbnail,
        filename,
        `読み切りCSV ${rowIndex + 2}行目`,
      );
      if (itemMap.has(filename)) {
        throw new Error(`読み切りCSVに同じファイル名があります: ${filename}`);
      }

      const voteCounts = readVoteCounts(row, rowIndex + 2, "読み切りCSV");
      const genres = readGenreValues(row, genreNames, rowIndex + 2, "読み切りCSV");
      const item = {
        filename,
        title,
        summary,
        thumbnail,
        duplicateOf,
        genres,
        ...voteCounts,
      };
      allItems.push(item);
      itemMap.set(filename, item);
    });

    allItems.forEach((item) => {
      if (item.duplicateOf && !itemMap.has(item.duplicateOf)) {
        throw new Error(`重複元ファイルが作品一覧にありません: ${item.duplicateOf}`);
      }
    });

    const items = allItems.filter((item) => !item.duplicateOf);
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
      const summary = row["概要"];
      const thumbnail = row["サムネイル"];
      const serialState = row["連載状態"];

      if (!SERIAL_ID_PATTERN.test(seriesId)) {
        throw new Error(`連載CSV ${rowIndex + 2}行目の連載IDが不正です。`);
      }
      validateSerialThumbnailPath(
        thumbnail,
        `thumbnails/serials/${seriesId}/series.webp`,
        `連載CSV ${rowIndex + 2}行目`,
      );
      if (!title) {
        throw new Error(`連載CSV ${rowIndex + 2}行目のタイトルが空です。`);
      }
      const summaryLength = Array.from(summary).length;
      if (
        summaryLength < SUMMARY_MIN_LENGTH ||
        summaryLength > SUMMARY_MAX_LENGTH
      ) {
        throw new Error(
          `連載CSV ${rowIndex + 2}行目の概要は${SUMMARY_MIN_LENGTH}〜${SUMMARY_MAX_LENGTH}文字にしてください。`,
        );
      }
      if (!SERIAL_STATES.has(serialState)) {
        throw new Error(`連載CSV ${rowIndex + 2}行目の連載状態が不正です。`);
      }
      if (itemMap.has(seriesId)) {
        throw new Error(`連載CSVに同じ連載IDがあります: ${seriesId}`);
      }

      const voteCounts = readVoteCounts(row, rowIndex + 2, "連載CSV");
      const genres = readGenreValues(row, genreNames, rowIndex + 2, "連載CSV");
      const item = {
        seriesId,
        title,
        summary,
        thumbnail,
        serialState,
        genres,
        ...voteCounts,
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
    const volumeMode = sameStringArray(headers, VOLUME_EPISODE_COLUMNS);
    if (!volumeMode && !sameStringArray(headers, EPISODE_COLUMNS)) {
      throw new Error("episodes.csvの列が規定と一致しません。");
    }

    const episodes = [];
    const episodeMap = new Map();
    const orderValues = new Set();
    const filenames = new Set();
    const chapterGroups = new Map();
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
      if (volumeMode) {
        const volumeId = row["巻ID"];
        const chapterId = row["章ID"];
        const chapterLabel = row["章数表示"];
        const partLabel = row["節表示"];
        if (!VOLUME_ID_PATTERN.test(volumeId)) {
          throw new Error(`episodes.csv ${rowIndex + 2}行目の巻IDが不正です。`);
        }
        if (!CHAPTER_ID_PATTERN.test(chapterId)) {
          throw new Error(`episodes.csv ${rowIndex + 2}行目の章IDが不正です。`);
        }
        if (!chapterLabel || !title) {
          throw new Error(`episodes.csv ${rowIndex + 2}行目の章情報が空です。`);
        }
        if (partLabel !== "前編" && partLabel !== "後編") {
          throw new Error(`episodes.csv ${rowIndex + 2}行目の節表示が不正です。`);
        }
        Object.assign(episode, {
          volumeId,
          chapterId,
          chapterLabel,
          partLabel,
        });

        const chapterKey = `${volumeId}:${chapterId}`;
        const chapter = chapterGroups.get(chapterKey);
        if (chapter && (chapter.label !== chapterLabel || chapter.title !== title)) {
          throw new Error(`episodes.csvの${chapterKey}で章情報が一致しません。`);
        }
        if (chapter) {
          chapter.episodes.push(episode);
        } else {
          chapterGroups.set(chapterKey, {
            label: chapterLabel,
            title,
            episodes: [episode],
          });
        }
      }
      episodes.push(episode);
      episodeMap.set(episodeId, episode);
      orderValues.add(displayOrder);
      filenames.add(filename);
    });

    episodes.sort((left, right) => left.displayOrder - right.displayOrder);
    if (volumeMode) {
      chapterGroups.forEach((chapter, chapterKey) => {
        chapter.episodes.sort((left, right) => left.displayOrder - right.displayOrder);
        if (
          chapter.episodes.length !== 2 ||
          chapter.episodes[0].partLabel !== "前編" ||
          chapter.episodes[1].partLabel !== "後編"
        ) {
          throw new Error(`episodes.csvの${chapterKey}は前編・後編の2話にしてください。`);
        }
      });
    }
    return { episodes, episodeMap, volumeMode };
  }

  function buildVolumeCatalog(csvText, series, episodeCatalog) {
    const table = parseCsv(csvText);
    if (table.length < 2) {
      throw new Error(`「${series.title}」に巻情報がありません。`);
    }
    const headers = table[0].map((header) => header.trim());
    if (!sameStringArray(headers, VOLUME_COLUMNS)) {
      throw new Error("volumes.csvの列が規定と一致しません。");
    }

    const volumes = [];
    const volumeMap = new Map();
    const orderValues = new Set();
    table.slice(1).forEach((fields, rowIndex) => {
      const row = makeRow(headers, fields, rowIndex + 2, "volumes.csv");
      const volumeId = row["巻ID"];
      const orderText = row["表示順"];
      const label = row["巻数表示"];
      const title = row["巻タイトル"];
      const thumbnail = row["サムネイル"];
      if (!VOLUME_ID_PATTERN.test(volumeId)) {
        throw new Error(`volumes.csv ${rowIndex + 2}行目の巻IDが不正です。`);
      }
      if (!/^(0|[1-9][0-9]*)$/.test(orderText)) {
        throw new Error(`volumes.csv ${rowIndex + 2}行目の表示順が不正です。`);
      }
      const displayOrder = Number(orderText);
      if (!Number.isSafeInteger(displayOrder)) {
        throw new Error(`volumes.csv ${rowIndex + 2}行目の表示順が大きすぎます。`);
      }
      if (!label || !title) {
        throw new Error(`volumes.csv ${rowIndex + 2}行目の巻情報が空です。`);
      }
      validateSerialThumbnailPath(
        thumbnail,
        `thumbnails/serials/${series.seriesId}/volumes/${volumeId}.webp`,
        `volumes.csv ${rowIndex + 2}行目`,
      );
      if (volumeMap.has(volumeId)) {
        throw new Error(`volumes.csvに同じ巻IDがあります: ${volumeId}`);
      }
      if (orderValues.has(displayOrder)) {
        throw new Error(`volumes.csvに同じ表示順があります: ${displayOrder}`);
      }
      const volume = {
        volumeId,
        displayOrder,
        label,
        title,
        thumbnail,
        episodes: [],
        chapters: [],
      };
      volumes.push(volume);
      volumeMap.set(volumeId, volume);
      orderValues.add(displayOrder);
    });
    volumes.sort((left, right) => left.displayOrder - right.displayOrder);

    episodeCatalog.episodes.forEach((episode) => {
      const volume = volumeMap.get(episode.volumeId);
      if (!volume) {
        throw new Error(`episodes.csvの巻IDがvolumes.csvにありません: ${episode.volumeId}`);
      }
      episode.volumeLabel = volume.label;
      episode.volumeTitle = volume.title;
      volume.episodes.push(episode);
    });
    volumes.forEach((volume) => {
      if (volume.episodes.length === 0) {
        throw new Error(`volumes.csvの${volume.volumeId}にWeb話がありません。`);
      }
      const chapterMap = new Map();
      volume.episodes.forEach((episode) => {
        let chapter = chapterMap.get(episode.chapterId);
        if (!chapter) {
          chapter = {
            chapterId: episode.chapterId,
            label: episode.chapterLabel,
            title: episode.title,
            episodes: [],
          };
          chapterMap.set(episode.chapterId, chapter);
          volume.chapters.push(chapter);
        }
        chapter.episodes.push(episode);
      });
    });

    const episodeVolumeOrder = [];
    episodeCatalog.episodes.forEach((episode) => {
      if (episodeVolumeOrder.at(-1) !== episode.volumeId) {
        episodeVolumeOrder.push(episode.volumeId);
      }
    });
    if (!sameStringArray(episodeVolumeOrder, volumes.map((volume) => volume.volumeId))) {
      throw new Error("volumes.csvとepisodes.csvの巻順が一致しません。");
    }
    return {
      ...episodeCatalog,
      volumes,
      volumeMap,
    };
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

  function readVoteCounts(row, lineNumber, label) {
    const counts = {};
    VOTE_COLUMNS.forEach((column) => {
      const value = row[column];
      if (!/^(0|[1-9][0-9]*)$/.test(value)) {
        throw new Error(
          `${label} ${lineNumber}行目の「${column}」は0以上の整数ではありません。`,
        );
      }
      const count = Number(value);
      if (!Number.isSafeInteger(count) || count > MAX_BASE_VOTE_COUNT) {
        throw new Error(`${label} ${lineNumber}行目の「${column}」が大きすぎます。`);
      }
      counts[column === "Good数" ? "baseGood" : "baseBad"] = count;
    });
    return counts;
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

  function validateThumbnailPath(thumbnailPath, filename, label) {
    if (!thumbnailPath) {
      return;
    }
    const expectedPath = `thumbnails/${filename.slice(0, -4)}.webp`;
    if (
      thumbnailPath !== expectedPath ||
      /[\u0000-\u001f\u007f?#]/u.test(thumbnailPath)
    ) {
      throw new Error(`${label}のサムネイル相対パスが不正です。`);
    }
  }

  function validateSerialThumbnailPath(thumbnailPath, expectedPath, label) {
    if (!thumbnailPath) {
      return;
    }
    if (
      thumbnailPath !== expectedPath ||
      /[\u0000-\u001f\u007f?#]/u.test(thumbnailPath)
    ) {
      throw new Error(`${label}のサムネイル相対パスが不正です。`);
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
      const lastFocusedControl = lastFocusedWork &&
        typeof historyData.lastFocusedControl === "string"
        ? historyData.lastFocusedControl
        : null;
      history.replaceState(
        {
          ...historyData,
          view: "portal",
          catalogType: normalizedType,
          lastFocusedWork,
          lastFocusedControl,
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

  function renderCatalog(options = {}) {
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
    const rankedItems = catalog.items
      .map((item) => addEffectiveVotes(item, state.activeCatalogType))
      .sort(compareRankedItems)
      .map((item, index) => ({ ...item, displayNumber: index + 1 }));
    const matchingItems = rankedItems.filter((item) => {
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
    if (options.updateStatus !== false) {
      updateCatalogStatus(matchingItems.length, catalog.items.length);
    }
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

  function addEffectiveVotes(item, catalogType) {
    const workKey = getWorkKey(item, catalogType);
    const selectedVote = state.votes.get(workKey) || null;
    return {
      ...item,
      workKey,
      selectedVote,
      goodCount: item.baseGood + (selectedVote === "good" ? 1 : 0),
      badCount: item.baseBad + (selectedVote === "bad" ? 1 : 0),
    };
  }

  function compareRankedItems(left, right) {
    if (left.goodCount !== right.goodCount) {
      return left.goodCount > right.goodCount ? -1 : 1;
    }
    if (left.badCount !== right.badCount) {
      return left.badCount < right.badCount ? -1 : 1;
    }
    const titleOrder = TITLE_COLLATOR.compare(left.title, right.title);
    return titleOrder || TITLE_COLLATOR.compare(left.workKey, right.workKey);
  }

  function getWorkKey(item, catalogType) {
    return catalogType === "serial"
      ? `serial:${item.seriesId}`
      : `one-shot:${item.filename}`;
  }

  function createOneShotCard(item) {
    const link = createWorkCardShell(
      `No. ${String(item.displayNumber).padStart(3, "0")}`,
      item.title,
      item.genres,
      item.summary,
    );
    link.classList.add("novel-card--one-shot");
    link.prepend(
      createThumbnailMedia(item.thumbnail, item.genres, {
        className: "novel-card__thumbnail",
        imageClassName: "novel-card__thumbnail-image",
      }),
    );
    link.setAttribute("href", buildOneShotHash(item.filename));
    link.dataset.filename = item.filename;
    link.dataset.focusKey = item.workKey;
    return wrapListItem(link, item);
  }

  function createThumbnailMedia(thumbnailPath, genres, options = {}) {
    const thumbnail = document.createElement("span");
    thumbnail.className = `thumbnail-media ${options.className || ""}`.trim();
    configureThumbnailMedia(thumbnail, thumbnailPath, genres, options);
    return thumbnail;
  }

  function configureThumbnailMedia(thumbnail, thumbnailPath, genres, options = {}) {
    thumbnail.replaceChildren();
    thumbnail.dataset.thumbnailTheme = getThumbnailTheme(genres);
    thumbnail.dataset.thumbnailState = thumbnailPath ? "loading" : "fallback";
    thumbnail.setAttribute("aria-hidden", "true");

    if (!thumbnailPath) {
      return;
    }

    const image = document.createElement("img");
    image.className = `thumbnail-media__image ${options.imageClassName || ""}`.trim();
    image.alt = "";
    image.setAttribute("width", String(options.width || 800));
    image.setAttribute("height", String(options.height || 450));
    image.setAttribute("loading", options.loading || "lazy");
    image.setAttribute("decoding", "async");
    image.addEventListener(
      "load",
      () => {
        thumbnail.dataset.thumbnailState = "loaded";
      },
      { once: true },
    );
    image.addEventListener(
      "error",
      () => {
        thumbnail.dataset.thumbnailState = "fallback";
        image.remove();
      },
      { once: true },
    );
    image.setAttribute("src", withAssetVersion(thumbnailPath).href);
    thumbnail.append(image);
  }

  function getThumbnailTheme(genres) {
    for (const genre of genres) {
      const theme = THUMBNAIL_THEME_BY_GENRE[genre];
      if (theme) {
        return theme;
      }
    }
    return "default";
  }

  function createSeriesCard(item) {
    const link = document.createElement("a");
    link.className = "novel-card";
    link.setAttribute("href", buildSeriesHash(item.seriesId));
    link.dataset.seriesId = item.seriesId;
    link.dataset.focusKey = item.workKey;

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
    const summary = document.createElement("span");
    summary.className = "novel-card__summary";
    summary.textContent = item.summary;
    const callToAction = document.createElement("span");
    callToAction.className = "novel-card__cta";
    callToAction.textContent = "目次を開く";
    link.append(
      createThumbnailMedia(item.thumbnail, item.genres, {
        className: "novel-card__thumbnail",
        imageClassName: "novel-card__thumbnail-image",
      }),
      meta,
      title,
      summary,
      createTagList(item.genres),
      callToAction,
    );
    return wrapListItem(link, item);
  }

  function createWorkCardShell(numberText, titleText, genres, summaryText = "") {
    const link = document.createElement("a");
    link.className = "novel-card";
    const number = document.createElement("span");
    number.className = "novel-card__number";
    number.setAttribute("aria-hidden", "true");
    number.textContent = numberText;
    const title = document.createElement("span");
    title.className = "novel-card__title";
    title.textContent = titleText;
    const summary = document.createElement("span");
    summary.className = "novel-card__summary";
    summary.textContent = summaryText;
    link.append(number, title, summary, createTagList(genres));
    return link;
  }

  function wrapListItem(content, itemData) {
    const item = document.createElement("div");
    item.className = "novel-card-item";
    item.setAttribute("role", "listitem");
    item.append(content, createVoteControls(itemData));
    return item;
  }

  function createVoteControls(item) {
    const controls = document.createElement("div");
    controls.className = "vote-controls";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", `「${item.title}」の評価`);
    controls.append(
      createVoteButton(item, "good", "Good", item.goodCount),
      createVoteButton(item, "bad", "Bad", item.badCount),
    );
    return controls;
  }

  function createVoteButton(item, voteKind, labelText, count) {
    const selected = item.selectedVote === voteKind;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `vote-button vote-button--${voteKind}`;
    button.dataset.voteKind = voteKind;
    button.dataset.workKey = item.workKey;
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute(
      "aria-label",
      selected
        ? `「${item.title}」の${labelText}評価を取り消す。現在${count}件`
        : `「${item.title}」を${labelText}評価する。現在${count}件`,
    );

    const label = document.createElement("span");
    label.className = "vote-button__label";
    label.textContent = labelText;
    const countText = document.createElement("span");
    countText.className = "vote-button__count";
    countText.textContent = String(count);
    button.append(label, countText);
    return button;
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

  function handleWorkListClick(event) {
    const voteButton = event.target.closest("button[data-vote-kind][data-work-key]");
    if (voteButton) {
      handleVote(voteButton);
      return;
    }
    handleWorkLinkClick(event);
  }

  function handleVote(button) {
    const workKey = button.dataset.workKey;
    const voteKind = button.dataset.voteKind;
    if (!workKey || (voteKind !== "good" && voteKind !== "bad")) {
      return;
    }

    const item = findItemByWorkKey(workKey);
    if (!item) {
      return;
    }
    const previousVote = state.votes.get(workKey) || null;
    const nextVote = previousVote === voteKind ? null : voteKind;
    const sessionVotes = new Map(state.votes);
    if (nextVote) {
      sessionVotes.set(workKey, nextVote);
    } else {
      sessionVotes.delete(workKey);
    }
    const saveResult = saveVote(workKey, nextVote, sessionVotes);
    state.votes = saveResult.votes;
    state.voteStorageAvailable = saveResult.saved;
    updateVoteStorageNote();
    savePortalHistory(workKey, `vote:${voteKind}`);
    renderCatalog({ updateStatus: false });

    const catalogType = workKey.startsWith("serial:") ? "serial" : "one-shot";
    const updatedItem = addEffectiveVotes(item, catalogType);
    const action = nextVote === null
      ? `${voteKind === "good" ? "Good" : "Bad"}評価を取り消しました`
      : nextVote === voteKind && previousVote && previousVote !== voteKind
        ? `${previousVote === "good" ? "Good" : "Bad"}から${voteKind === "good" ? "Good" : "Bad"}へ変更しました`
        : `${voteKind === "good" ? "Good" : "Bad"}評価を付けました`;
    elements.voteStatus.textContent = "";
    requestAnimationFrame(() => {
      const replacement = [...elements.workList.querySelectorAll("button[data-work-key]")]
        .find((candidate) =>
          candidate.dataset.workKey === workKey &&
          candidate.dataset.voteKind === voteKind,
        );
      replacement?.focus({ preventScroll: true });
      replacement?.scrollIntoView({ block: "nearest", inline: "nearest" });
      const storageMessage = saveResult.saved
        ? ""
        : " この投票は、このページを閉じるまでのみ有効です。";
      elements.voteStatus.textContent =
        `「${item.title}」の${action}。Good ${updatedItem.goodCount}件、Bad ${updatedItem.badCount}件です。${storageMessage}`;
    });
  }

  function findItemByWorkKey(workKey) {
    for (const catalogType of CATALOG_TYPES) {
      const item = state.catalogs[catalogType].items.find(
        (candidate) => getWorkKey(candidate, catalogType) === workKey,
      );
      if (item) {
        return item;
      }
    }
    return null;
  }

  function handleWorkLinkClick(event) {
    const link = event.target.closest("a[data-filename], a[data-series-id]");
    if (!link || !shouldHandleLinkClick(event)) {
      return;
    }

    event.preventDefault();
    savePortalHistory(link.dataset.focusKey, "link");
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

  function savePortalHistory(focusKey, focusControl = "link") {
    const historyData = isPlainObject(history.state) ? history.state : {};
    history.replaceState(
      {
        ...historyData,
        view: "portal",
        catalogType: state.activeCatalogType,
        portalScrollY: window.scrollY,
        lastFocusedWork: focusKey,
        lastFocusedControl: focusControl,
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
    resetExtendedReader();
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
        const voteKind = typeof historyData.lastFocusedControl === "string" &&
          historyData.lastFocusedControl.startsWith("vote:")
          ? historyData.lastFocusedControl.slice("vote:".length)
          : null;
        const voteButton = voteKind === "good" || voteKind === "bad"
          ? [...elements.workList.querySelectorAll("button[data-work-key]")].find(
            (candidate) =>
              candidate.dataset.workKey === historyData.lastFocusedWork &&
              candidate.dataset.voteKind === voteKind,
          )
          : null;
        const card = voteButton ||
          [...elements.workList.querySelectorAll("a[data-focus-key]")].find(
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
    resetExtendedReader();
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
    configureThumbnailMedia(
      elements.seriesThumbnail,
      series.thumbnail,
      series.genres,
      { imageClassName: "series-header__thumbnail-image" },
    );
    elements.seriesTags.replaceChildren(...createGenreTags(series.genres));
    elements.seriesSummary.hidden = true;
    elements.seriesActions.hidden = true;
    elements.episodeCatalogTitle.textContent = "目次";
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
    let manifest = buildEpisodeCatalog(csvText, series);
    if (manifest.volumeMode) {
      const volumesUrl = new URL("./volumes.csv", seriesDirectory);
      const volumesText = await fetchText(volumesUrl, "巻一覧", {
        signal: options.signal,
      });
      manifest = buildVolumeCatalog(volumesText, series, manifest);
    }
    state.seriesCache.set(series.seriesId, manifest);
    return manifest;
  }

  function renderSeriesEpisodes(series, manifest) {
    const fragment = document.createDocumentFragment();
    if (manifest.volumeMode) {
      manifest.volumes.forEach((volume) => {
        fragment.append(createVolumeContents(series, volume));
      });
    } else {
      manifest.episodes.forEach((episode) => {
        fragment.append(createEpisodeListItem(series, episode));
      });
    }

    const firstEpisode = manifest.episodes[0];
    const latestEpisode = manifest.episodes.at(-1);
    configureEpisodeLink(elements.firstEpisodeLink, series, firstEpisode);
    configureEpisodeLink(elements.latestEpisodeLink, series, latestEpisode);
    elements.firstEpisodeLink.textContent = manifest.volumeMode
      ? "最初から読む"
      : "第1話から読む";
    elements.latestEpisodeLink.textContent = manifest.volumeMode
      ? "最終Web話を読む"
      : "最新話を読む";
    elements.latestEpisodeLink.hidden = firstEpisode === latestEpisode;
    elements.episodeCatalogTitle.textContent = manifest.volumeMode
      ? "巻・Web話目次"
      : "目次";
    elements.seriesSummary.textContent = series.summary;
    elements.seriesSummary.hidden = false;
    elements.seriesActions.hidden = false;
    elements.episodeCount.textContent = manifest.volumeMode
      ? `全${manifest.volumes.length}巻・${manifest.episodes.length}Web話`
      : `全${manifest.episodes.length}話`;
    elements.seriesStatus.hidden = true;
    elements.episodeList.replaceChildren(fragment);
    elements.episodeList.hidden = false;
  }

  function createVolumeContents(series, volume) {
    const item = document.createElement("div");
    item.className = "volume-list-item";
    item.setAttribute("role", "listitem");
    const details = document.createElement("details");
    details.className = "volume-details";
    details.dataset.volumeId = volume.volumeId;
    details.addEventListener("toggle", handleVolumeToggle);

    const summary = document.createElement("summary");
    summary.className = "volume-summary";
    summary.dataset.seriesFocusKey = `volume:${volume.volumeId}`;
    summary.addEventListener("click", handleVolumeSummaryClick);
    const number = document.createElement("span");
    number.className = "volume-summary__number";
    number.textContent = volume.label;
    const title = document.createElement("span");
    title.className = "volume-summary__title";
    title.textContent = volume.title;
    const count = document.createElement("span");
    count.className = "volume-summary__count";
    count.textContent = `${volume.chapters.length}章・${volume.episodes.length}Web話`;
    const marker = document.createElement("span");
    marker.className = "volume-summary__marker";
    marker.setAttribute("aria-hidden", "true");
    summary.append(
      createThumbnailMedia(volume.thumbnail, series.genres, {
        className: "volume-summary__thumbnail",
        imageClassName: "volume-summary__thumbnail-image",
      }),
      number,
      title,
      count,
      marker,
    );

    const body = document.createElement("div");
    body.className = "volume-details__body";
    volume.chapters.forEach((chapter) => {
      const section = document.createElement("section");
      section.className = "chapter-group";
      const headingId = `chapter-${volume.volumeId}-${chapter.chapterId}`;
      const heading = document.createElement("h3");
      heading.id = headingId;
      heading.className = "chapter-group__heading";
      const chapterNumber = document.createElement("span");
      chapterNumber.className = "chapter-group__number";
      chapterNumber.textContent = chapter.label;
      const chapterTitle = document.createElement("span");
      chapterTitle.className = "chapter-group__title";
      chapterTitle.textContent = chapter.title;
      heading.append(chapterNumber, chapterTitle);

      const episodeList = document.createElement("div");
      episodeList.className = "chapter-episode-list";
      episodeList.setAttribute("role", "list");
      episodeList.setAttribute(
        "aria-label",
        `${volume.label} ${chapter.label}「${chapter.title}」`,
      );
      chapter.episodes.forEach((episode) => {
        episodeList.append(createEpisodeListItem(series, episode, { compact: true }));
      });
      section.append(heading, episodeList);
      body.append(section);
    });
    details.append(summary, body);
    item.append(details);
    return item;
  }

  function handleVolumeToggle(event) {
    const details = event.currentTarget;
    if (details.open) {
      elements.episodeList
        .querySelectorAll("details.volume-details[open]")
        .forEach((candidate) => {
          if (candidate !== details) {
            candidate.open = false;
          }
        });
    }
    if (state.suppressScrollSnapshot) {
      return;
    }
    requestAnimationFrame(snapshotOpenVolume);
  }

  function handleVolumeSummaryClick(event) {
    if (state.suppressScrollSnapshot) {
      return;
    }
    const historyData = isPlainObject(history.state) ? history.state : {};
    if (historyData.view !== "series") {
      return;
    }
    history.replaceState(
      {
        ...historyData,
        seriesFocusKey: event.currentTarget.dataset.seriesFocusKey,
        lastFocusedEpisode: null,
      },
      "",
      location.href,
    );
  }

  function snapshotOpenVolume() {
    if (elements.body.dataset.view !== "series") {
      return;
    }
    const historyData = isPlainObject(history.state) ? history.state : {};
    if (historyData.view !== "series") {
      return;
    }
    const openVolume = elements.episodeList.querySelector(
      "details.volume-details[open]",
    );
    const seriesOpenVolumeId = openVolume?.dataset.volumeId || null;
    if (historyData.seriesOpenVolumeId === seriesOpenVolumeId) {
      return;
    }
    history.replaceState(
      {
        ...historyData,
        seriesOpenVolumeId,
      },
      "",
      location.href,
    );
  }

  function createEpisodeListItem(series, episode, options = {}) {
    const item = document.createElement("div");
    item.className = options.compact
      ? "episode-list-item episode-list-item--part"
      : "episode-list-item";
    item.setAttribute("role", "listitem");
    const link = document.createElement("a");
    link.className = "episode-link";
    link.href = buildEpisodeHash(series.seriesId, episode.episodeId);
    link.dataset.seriesId = series.seriesId;
    link.dataset.episodeId = episode.episodeId;
    link.dataset.seriesFocusKey = `list:${episode.episodeId}`;
    if (episode.volumeId) {
      link.setAttribute(
        "aria-label",
        `${episode.label}、${episode.volumeLabel}、${episode.chapterLabel}「${episode.title}」${episode.partLabel}`,
      );
    }

    const number = document.createElement("span");
    number.className = "episode-link__number";
    number.textContent = episode.label;
    const title = document.createElement("span");
    title.className = "episode-link__title";
    title.textContent = options.compact
      ? episode.partLabel
      : episode.title || "本文を読む";
    const arrow = document.createElement("span");
    arrow.className = "episode-link__arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    link.append(number, title, arrow);
    item.append(link);
    return item;
  }

  function configureEpisodeLink(link, series, episode) {
    link.href = buildEpisodeHash(series.seriesId, episode.episodeId);
    link.dataset.seriesId = series.seriesId;
    link.dataset.episodeId = episode.episodeId;
  }

  function restoreSeriesPosition(series) {
    let historyData = isPlainObject(history.state) ? history.state : {};
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
    const controls = [
      ...elements.seriesView.querySelectorAll("[data-series-focus-key]"),
    ];
    const link = focusKey || fallbackEpisodeId
      ? controls.find(
        (candidate) => candidate.dataset.seriesFocusKey === focusKey,
      ) || controls.find(
        (candidate) => candidate.dataset.episodeId === fallbackEpisodeId,
      )
      : null;
    const episodeVolume = link?.dataset.seriesFocusKey?.startsWith("list:")
      ? link.closest("details.volume-details")
      : null;
    const volumeDetails = [
      ...elements.episodeList.querySelectorAll("details.volume-details"),
    ];
    const savedVolume = historyData.seriesOpenVolumeId
      ? volumeDetails.find(
        (candidate) =>
          candidate.dataset.volumeId === historyData.seriesOpenVolumeId,
      )
      : null;
    const volumeToOpen = episodeVolume || savedVolume;
    volumeDetails.forEach((candidate) => {
      candidate.open = candidate === volumeToOpen;
    });
    if (hasPendingFocus && historyData.view === "series") {
      historyData = {
        ...historyData,
        lastFocusedEpisode: pendingFocus.episodeId,
        seriesFocusKey: `list:${pendingFocus.episodeId}`,
        seriesOpenVolumeId: episodeVolume?.dataset.volumeId || null,
      };
      history.replaceState(historyData, "", location.href);
    }
    completeScrollRestore(hasSavedPosition ? historyData.seriesScrollY : 0, () => {
      if (focusKey || fallbackEpisodeId) {
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
          seriesOpenVolumeId: elements.episodeList.querySelector(
            "details.volume-details[open]",
          )?.dataset.volumeId || null,
        },
        "",
        location.href,
      );
    } else if (options.source === "reader") {
      if (Number.isSafeInteger(historyData.seriesReturnDepth)) {
        seriesReturnDepth = historyData.seriesReturnDepth + 1;
      }
      history.replaceState(
        captureReaderHistory(
          historyData,
          options.returnFocusKey || historyData.readerFocusKey,
        ),
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
      focusHeading: false,
    });
    prepareExtendedReader(item);

    const controller = new AbortController();
    state.requestController = controller;
    try {
      const documentUrl = buildExtendedHtmlUrl(item.filename);
      await fetchText(documentUrl, "拡張フォント版本文", {
        signal: controller.signal,
        cache: options.forceReload ? "reload" : "default",
      });
      if (routeToken !== state.routeToken || state.currentRouteKey !== routeKey) {
        return;
      }
      loadExtendedReaderFrame(documentUrl, routeToken, routeKey);
    } catch (error) {
      if (error.name !== "AbortError" && routeToken === state.routeToken) {
        resetExtendedReader();
        showReaderError(error, () => showOneShot(item, { forceReload: true }));
      }
    } finally {
      if (state.requestController === controller) {
        state.requestController = null;
      }
    }
  }

  function prepareExtendedReader(item) {
    elements.body.dataset.readerMode = "extended-one-shot";
    elements.readerArticle.hidden = true;
    elements.readerFooter.hidden = true;
    elements.extendedReader.hidden = false;
    elements.extendedReader.dataset.ready = "false";
    elements.extendedReader.setAttribute("aria-busy", "true");
    elements.extendedReaderStatus.hidden = false;
    elements.extendedReaderStatus.textContent =
      "拡張フォント版の本文を読み込んでいます…";
    elements.extendedEpisodeNavigation.hidden = true;
    elements.extendedEpisodeNavigation.replaceChildren();
    elements.extendedReaderFrame.title = `${item.title} 拡張フォント版の本文`;
  }

  function prepareExtendedEpisodeReader(series, episode, manifest) {
    elements.body.dataset.readerMode = "extended-episode";
    elements.readerArticle.hidden = true;
    elements.readerFooter.hidden = true;
    elements.extendedReader.hidden = false;
    elements.extendedReader.dataset.ready = "false";
    elements.extendedReader.setAttribute("aria-busy", "true");
    elements.extendedReaderStatus.hidden = false;
    elements.extendedReaderStatus.textContent =
      "拡張フォント版の本文を読み込んでいます…";
    renderEpisodeNavigation(
      elements.extendedEpisodeNavigation,
      series,
      episode,
      manifest,
    );
    elements.extendedEpisodeNavigation.hidden = false;
    elements.extendedReaderFrame.title =
      `${formatEpisodeTitle(episode)} 拡張フォント版の本文`;
  }

  function loadExtendedReaderFrame(documentUrl, routeToken, routeKey, options = {}) {
    const frame = elements.extendedReaderFrame;
    frame.onload = () => {
      if (routeToken !== state.routeToken || state.currentRouteKey !== routeKey) {
        return;
      }
      guardReferenceChapterLinks(frame);
      if (options.kind === "episode") {
        guardEpisodeReaderLinks(frame);
      }
      attachFrameScrollTracking(frame);
      frame.onload = null;
      frame.onerror = null;
      elements.extendedReader.dataset.ready = "true";
      elements.extendedReader.setAttribute("aria-busy", "false");
      elements.extendedReaderStatus.hidden = true;
      restoreExtendedReaderPosition(frame);
    };
    frame.onerror = () => {
      if (routeToken !== state.routeToken || state.currentRouteKey !== routeKey) {
        return;
      }
      if (options.onError) {
        options.onError();
        return;
      }
      const item = state.currentReading?.item;
      resetExtendedReader();
      showReaderError(
        new Error("拡張フォント版本文を表示できませんでした。"),
        () => item && showOneShot(item, { forceReload: true }),
      );
    };
    frame.contentWindow.location.replace(withAssetVersion(documentUrl).href);
  }

  function guardReferenceChapterLinks(frame) {
    try {
      const frameDocument = frame.contentDocument;
      if (
        !frameDocument?.body ||
        frameDocument.body.dataset.novelId ||
        frameDocument.documentElement.dataset.coldPrintChapterGuard === "true"
      ) {
        return;
      }
      frameDocument.documentElement.dataset.coldPrintChapterGuard = "true";
      frameDocument.addEventListener("click", (event) => {
        const link = event.target.closest?.('a[href^="#"]');
        if (
          !link ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        const rawHref = link.getAttribute("href");
        if (!rawHref || rawHref.length > 200) {
          return;
        }
        let targetId;
        try {
          targetId = decodeURIComponent(rawHref.slice(1));
        } catch (_error) {
          return;
        }
        const target = targetId ? frameDocument.getElementById(targetId) : null;
        if (!target?.closest("article.novel")) {
          return;
        }
        event.preventDefault();
        const reduceMotion = frame.contentWindow
          ?.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        });
      }, { capture: true });
    } catch (_error) {
      /* The reader remains usable if a browser blocks same-origin frame access. */
    }
  }

  function guardEpisodeReaderLinks(frame) {
    try {
      const frameDocument = frame.contentDocument;
      const reading = state.currentReading;
      if (
        !frameDocument?.body ||
        reading?.kind !== "episode" ||
        frameDocument.documentElement.dataset.coldPrintEpisodeGuard === "true"
      ) {
        return;
      }
      frameDocument.documentElement.dataset.coldPrintEpisodeGuard = "true";
      const controls = frameDocument.querySelectorAll("[data-serial-navigation]");
      controls.forEach((control) => {
        if (!(control instanceof frame.contentWindow.HTMLAnchorElement)) {
          return;
        }
        const standaloneUrl = new URL(
          "../../../../cold_print.html",
          frameDocument.baseURI,
        );
        if (control.dataset.serialNavigation === "contents") {
          standaloneUrl.hash = buildSeriesHash(reading.series.seriesId);
        } else {
          const targetEpisodeId = control.dataset.episodeId;
          if (!reading.manifest.episodeMap.has(targetEpisodeId)) {
            control.removeAttribute("href");
            control.setAttribute("aria-disabled", "true");
            return;
          }
          standaloneUrl.hash = buildEpisodeHash(
            reading.series.seriesId,
            targetEpisodeId,
          );
        }
        control.href = standaloneUrl.href;
      });
      frameDocument.addEventListener("click", (event) => {
        const control = event.target.closest?.("[data-serial-navigation]");
        if (!control || !shouldHandleLinkClick(event)) {
          return;
        }
        event.preventDefault();
        if (control.dataset.serialNavigation === "contents") {
          navigateToSeries(reading.series.seriesId, {
            returnFocusKey: "extended-episode:contents",
          });
          return;
        }
        const targetEpisodeId = control.dataset.episodeId;
        if (
          typeof targetEpisodeId !== "string" ||
          targetEpisodeId === reading.episode.episodeId ||
          !reading.manifest.episodeMap.has(targetEpisodeId)
        ) {
          return;
        }
        navigateToEpisode(reading.series.seriesId, targetEpisodeId, {
          source: "reader",
          returnFocusKey: "extended-episode:navigation",
        });
      }, { capture: true });
    } catch (_error) {
      /* The parent navigation remains available if frame access is blocked. */
    }
  }

  function attachFrameScrollTracking(frame) {
    detachFrameScrollTracking();
    try {
      const frameWindow = frame.contentWindow;
      if (!frameWindow) {
        return;
      }
      const handleScroll = () => {
        state.currentFrameScrollY = readFrameScrollY(frameWindow);
        requestHistorySnapshot();
      };
      const handleScrollEnd = () => {
        state.currentFrameScrollY = readFrameScrollY(frameWindow);
        flushHistorySnapshot();
      };
      frameWindow.addEventListener("scroll", handleScroll, { passive: true });
      frameWindow.addEventListener("scrollend", handleScrollEnd, { passive: true });
      state.frameScrollWindow = frameWindow;
      state.frameScrollHandler = handleScroll;
      state.frameScrollEndHandler = handleScrollEnd;
      state.currentFrameScrollY = readFrameScrollY(frameWindow);
    } catch (_error) {
      state.currentFrameScrollY = 0;
    }
  }

  function detachFrameScrollTracking() {
    if (state.frameScrollWindow && state.frameScrollHandler) {
      try {
        state.frameScrollWindow.removeEventListener(
          "scroll",
          state.frameScrollHandler,
        );
        state.frameScrollWindow.removeEventListener(
          "scrollend",
          state.frameScrollEndHandler,
        );
      } catch (_error) {
        /* A navigated frame may no longer expose its previous Window object. */
      }
    }
    state.frameScrollWindow = null;
    state.frameScrollHandler = null;
    state.frameScrollEndHandler = null;
  }

  function readFrameScrollY(frameWindow = state.frameScrollWindow) {
    if (!frameWindow) {
      return Math.max(0, state.currentFrameScrollY || 0);
    }
    try {
      return Math.max(
        0,
        frameWindow?.scrollY ||
          frameWindow?.document?.documentElement?.scrollTop ||
          0,
      );
    } catch (_error) {
      return Math.max(0, state.currentFrameScrollY || 0);
    }
  }

  function restoreExtendedReaderPosition(frame) {
    const historyData = isPlainObject(history.state) ? history.state : {};
    const scrollY = Number.isFinite(historyData.readerFrameScrollY)
      ? historyData.readerFrameScrollY
      : 0;
    completeScrollRestore(0, () => {
      try {
        frame.contentWindow?.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
      } catch (_error) {
        /* The child may restore itself when same-origin frame access is blocked. */
      }
      state.currentFrameScrollY = scrollY;
      const focusControl = historyData.readerFocusKey
        ? [...elements.readerView.querySelectorAll("[data-reader-focus-key]")].find(
          (candidate) =>
            candidate.dataset.readerFocusKey === historyData.readerFocusKey,
        )
        : null;
      (focusControl || frame).focus({ preventScroll: true });
      try {
        frame.contentWindow?.postMessage(
          { type: "cold-print:restore-scroll", scrollY },
          location.origin === "null" ? "*" : location.origin,
        );
      } catch (_error) {
        /* Direct scroll restoration above is sufficient for same-origin pages. */
      }
    });
  }

  function resetExtendedReader() {
    const frame = elements.extendedReaderFrame;
    detachFrameScrollTracking();
    frame.onload = null;
    frame.onerror = null;
    try {
      frame.contentWindow?.location.replace("about:blank");
    } catch (_error) {
      /* A fresh iframe is already blank; route cleanup can continue. */
    }
    frame.title = "拡張フォント版の本文";
    elements.extendedReader.hidden = true;
    elements.extendedReader.dataset.ready = "false";
    elements.extendedReader.setAttribute("aria-busy", "true");
    elements.extendedReaderStatus.hidden = false;
    elements.extendedEpisodeNavigation.hidden = true;
    elements.extendedEpisodeNavigation.replaceChildren();
    elements.readerArticle.hidden = false;
    state.currentFrameScrollY = 0;
    delete elements.body.dataset.readerMode;
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

      let usePlainText = Boolean(options.plainTextOnly);
      if (!usePlainText) {
        const documentUrl = buildEpisodeHtmlUrl(series.seriesId, episode.episodeId);
        try {
          await fetchText(documentUrl, "拡張フォント版本文", {
            signal: controller.signal,
            cache: options.forceExtended ? "reload" : "default",
          });
        } catch (error) {
          if (error.name === "AbortError") {
            throw error;
          }
          usePlainText = true;
        }
        if (routeToken !== state.routeToken || state.currentRouteKey !== routeKey) {
          return;
        }
        if (!usePlainText) {
          prepareExtendedEpisodeReader(series, episode, manifest);
          loadExtendedReaderFrame(documentUrl, routeToken, routeKey, {
            kind: "episode",
            onError: () =>
              showEpisode(series, episodeId, {
                plainTextOnly: true,
                forceText: true,
              }),
          });
          return;
        }
      }

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
            plainTextOnly: true,
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
    resetExtendedReader();
    beginScrollRestore();
    elements.portalView.hidden = true;
    elements.seriesView.hidden = true;
    elements.readerView.hidden = false;
    elements.body.dataset.view = "reader";
    elements.readerArticle.hidden = false;
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
    if (
      options.focusHeading !== false &&
      !Number.isFinite(historyData.readerScrollY)
    ) {
      requestAnimationFrame(() => elements.readerTitle.focus({ preventScroll: true }));
    }
    requestProgressUpdate();
  }

  function updateEpisodeReaderHeader(series, episode, manifest) {
    const heading = formatEpisodeTitle(episode);
    elements.readerTitle.textContent = heading;
    elements.readerSeriesTitle.textContent = episode.volumeId
      ? `${series.title}　/　${episode.volumeLabel}「${episode.volumeTitle}」`
      : series.title;
    elements.readerSeriesTitle.hidden = false;
    elements.readerBackLabel.textContent = episode.volumeId
      ? `${episode.volumeLabel}の目次へ`
      : "目次へ";
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

  function handleExtendedReaderMessage(event) {
    if (
      event.source !== elements.extendedReaderFrame.contentWindow ||
      elements.extendedReader.hidden ||
      !isPlainObject(event.data) ||
      (location.origin !== "null" && event.origin !== location.origin)
    ) {
      return;
    }
    const reading = state.currentReading;
    if (event.data.type === "cold-print:reader-scroll") {
      if (
        Number.isFinite(event.data.scrollY) &&
        event.data.scrollY >= 0 &&
        event.data.scrollY <= Number.MAX_SAFE_INTEGER
      ) {
        state.currentFrameScrollY = event.data.scrollY;
        requestHistorySnapshot();
      }
      return;
    }
    if (event.data.type === "cold-print:return-to-portal") {
      if (reading?.kind === "one-shot") {
        returnFromOneShotToPortal(elements.readerBack.dataset.readerFocusKey);
      } else if (reading?.kind === "episode") {
        navigateToSeries(reading.series.seriesId, {
          returnFocusKey: "extended-episode:contents",
        });
      }
      return;
    }
    if (reading?.kind !== "episode") {
      return;
    }
    if (
      event.data.type === "cold-print:return-to-series" ||
      event.data.type === "cold-print:series-contents"
    ) {
      navigateToSeries(reading.series.seriesId, {
        returnFocusKey: "extended-episode:contents",
      });
      return;
    }

    let targetEpisodeId = null;
    if (event.data.type === "cold-print:navigate-episode") {
      targetEpisodeId = event.data.episodeId;
    } else if (
      event.data.type === "cold-print:previous-episode" ||
      event.data.type === "cold-print:next-episode"
    ) {
      const currentIndex = reading.manifest.episodes.findIndex(
        (episode) => episode.episodeId === reading.episode.episodeId,
      );
      const offset = event.data.type === "cold-print:previous-episode" ? -1 : 1;
      targetEpisodeId = reading.manifest.episodes[currentIndex + offset]?.episodeId;
    }
    if (
      typeof targetEpisodeId !== "string" ||
      targetEpisodeId === reading.episode.episodeId ||
      !reading.manifest.episodeMap.has(targetEpisodeId)
    ) {
      return;
    }
    navigateToEpisode(reading.series.seriesId, targetEpisodeId, {
      source: "reader",
      returnFocusKey: "extended-episode:navigation",
    });
  }

  function captureReaderHistory(historyData, readerFocusKey) {
    const snapshot = {
      ...historyData,
      readerFocusKey,
    };
    if (!elements.extendedReader.hidden) {
      snapshot.readerFrameScrollY = readFrameScrollY();
      delete snapshot.readerScrollY;
    } else {
      snapshot.readerScrollY = window.scrollY;
      delete snapshot.readerFrameScrollY;
    }
    return snapshot;
  }

  function navigateToSeries(seriesId, options = {}) {
    const historyData = isPlainObject(history.state) ? history.state : {};
    const returnDepth = Number.isSafeInteger(historyData.seriesReturnDepth)
      ? historyData.seriesReturnDepth
      : 0;
    const returnEpisodeId = historyData.view === "reader"
      ? historyData.episodeId
      : null;
    if (returnEpisodeId) {
      state.pendingSeriesFocus = {
        seriesId,
        episodeId: returnEpisodeId,
      };
    }
    if (historyData.view === "reader" && returnDepth > 0) {
      history.replaceState(
        captureReaderHistory(
          historyData,
          options.returnFocusKey || historyData.readerFocusKey,
        ),
        "",
        location.href,
      );
      history.go(-returnDepth);
      return;
    }
    if (historyData.view === "reader") {
      history.replaceState(
        captureReaderHistory(
          historyData,
          options.returnFocusKey || historyData.readerFocusKey,
        ),
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
        ...(returnEpisodeId
          ? {
            lastFocusedEpisode: returnEpisodeId,
            seriesFocusKey: `list:${returnEpisodeId}`,
          }
          : {}),
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
        captureReaderHistory(
          historyData,
          returnFocusKey || historyData.readerFocusKey,
        ),
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

  function buildExtendedHtmlUrl(filename) {
    const htmlFilename = `${filename.slice(0, -".txt".length)}.html`;
    return new URL(encodeURIComponent(htmlFilename), EXTENDED_HTML_DIRECTORY_URL);
  }

  function buildEpisodeHtmlUrl(seriesId, episodeId) {
    const seriesDirectory = new URL(
      `${encodeURIComponent(seriesId)}/`,
      SERIAL_DIRECTORY_URL,
    );
    const htmlDirectory = new URL("./htmls/", seriesDirectory);
    return new URL(`${encodeURIComponent(episodeId)}.html`, htmlDirectory);
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
    const extendedReaderActive =
      view === "reader" && !elements.extendedReader.hidden;
    const property = view === "portal"
      ? "portalScrollY"
      : view === "series"
        ? "seriesScrollY"
        : view === "reader"
          ? extendedReaderActive
            ? "readerFrameScrollY"
            : "readerScrollY"
          : null;
    if (!property) {
      return;
    }
    const scrollY = extendedReaderActive
      ? readFrameScrollY()
      : Math.max(0, window.scrollY);
    if (historyData[property] === scrollY) {
      return;
    }
    try {
      const snapshot = { ...historyData, [property]: scrollY };
      if (extendedReaderActive) {
        delete snapshot.readerScrollY;
      } else if (view === "reader") {
        delete snapshot.readerFrameScrollY;
      }
      history.replaceState(snapshot, "", location.href);
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
    if (episode.volumeId) {
      return `${episode.label}　${episode.volumeLabel}・${episode.chapterLabel}「${episode.title}」${episode.partLabel}`;
    }
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

  function isValidVoteWorkKey(workKey) {
    return /^(one-shot|serial):[^\r\n]{1,500}$/.test(workKey);
  }

  function parseStoredVotes(stored) {
    if (!stored) {
      return new Map();
    }
    let parsed;
    try {
      parsed = JSON.parse(stored);
    } catch {
      return new Map();
    }
    if (!isPlainObject(parsed)) {
      return new Map();
    }
    return new Map(
      Object.entries(parsed)
        .slice(0, 1000)
        .filter(([workKey, voteKind]) =>
          isValidVoteWorkKey(workKey) &&
          (voteKind === "good" || voteKind === "bad"),
        ),
    );
  }

  function loadVotes() {
    try {
      const votes = parseStoredVotes(
        localStorage.getItem(LEGACY_VOTE_STORAGE_KEY),
      );
      let storedVoteCount = 0;
      for (let index = 0; index < localStorage.length; index += 1) {
        const storageKey = localStorage.key(index);
        if (!storageKey?.startsWith(VOTE_STORAGE_PREFIX)) {
          continue;
        }
        storedVoteCount += 1;
        if (storedVoteCount > 1000) {
          break;
        }
        let workKey;
        try {
          workKey = decodeURIComponent(storageKey.slice(VOTE_STORAGE_PREFIX.length));
        } catch {
          continue;
        }
        if (!isValidVoteWorkKey(workKey)) {
          continue;
        }
        const voteKind = localStorage.getItem(storageKey);
        if (voteKind === "good" || voteKind === "bad") {
          votes.set(workKey, voteKind);
        } else if (voteKind === "none") {
          votes.delete(workKey);
        }
      }
      return {
        votes,
        storageAvailable: true,
      };
    } catch {
      return { votes: new Map(), storageAvailable: false };
    }
  }

  function saveVote(workKey, nextVote, sessionVotes) {
    try {
      localStorage.setItem(
        `${VOTE_STORAGE_PREFIX}${encodeURIComponent(workKey)}`,
        nextVote || "none",
      );
      return { votes: sessionVotes, saved: true };
    } catch {
      return { votes: sessionVotes, saved: false };
    }
  }

  function handleVoteStorageChange(event) {
    if (
      event.key !== null &&
      event.key !== LEGACY_VOTE_STORAGE_KEY &&
      !event.key.startsWith(VOTE_STORAGE_PREFIX)
    ) {
      return;
    }

    const voteState = loadVotes();
    state.votes = voteState.votes;
    state.voteStorageAvailable = voteState.storageAvailable;
    updateVoteStorageNote();
    if (!state.catalogsLoaded) {
      return;
    }

    const focusedElement = elements.workList.contains(document.activeElement)
      ? document.activeElement
      : null;
    const focusedWorkKey = focusedElement?.dataset.workKey ||
      focusedElement?.dataset.focusKey || null;
    const focusedVoteKind = focusedElement?.dataset.voteKind || null;
    renderCatalog({ updateStatus: false });

    if (focusedWorkKey) {
      requestAnimationFrame(() => {
        const selector = focusedVoteKind
          ? "button[data-work-key]"
          : "a[data-focus-key]";
        const replacement = [...elements.workList.querySelectorAll(selector)].find(
          (candidate) =>
            (candidate.dataset.workKey || candidate.dataset.focusKey) === focusedWorkKey &&
            (!focusedVoteKind || candidate.dataset.voteKind === focusedVoteKind),
        );
        replacement?.focus({ preventScroll: true });
      });
    }
  }

  function updateVoteStorageNote() {
    elements.voteNote.textContent = state.voteStorageAvailable
      ? "Good・Badの選択は、このブラウザに保存されます。"
      : "Good・Badの選択は、このページを閉じるまで有効です（ブラウザへ保存できません）。";
    elements.voteNote.classList.toggle(
      "vote-note--warning",
      !state.voteStorageAvailable,
    );
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
