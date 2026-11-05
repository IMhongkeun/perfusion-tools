/**
 * Lightweight tool workspace navigation and browser-only favorites.
 * Uses the existing calculator registry and recent-history implementation.
 * No calculator values or patient data are stored by this module.
 */
(function () {
  'use strict';

  const favoriteStorageKey = 'perfusiontools_favorite_calculators_v1';
  const sidebarStorageKey = 'perfusiontools_sidebar_view_v1';
  const recentStorageKey = 'perfusiontools_recent_calculators';
  const registry = Array.isArray(window.PerfusionToolsCalculatorRegistry)
    ? window.PerfusionToolsCalculatorRegistry : [];
  const byPath = new Map(registry.map(tool => [tool.path, tool]));
  const categories = [
    { key: 'all', label: 'All tools', icon: '▦' },
    { key: 'flow', label: 'Flow & Oxygenation', icon: '◉' },
    { key: 'blood', label: 'Blood & Volume', icon: '◈' },
    { key: 'anticoagulation', label: 'Anticoagulation', icon: '✚' },
    { key: 'circuit', label: 'Circuit & Cannulas', icon: '◇' },
    { key: 'pediatric', label: 'Pediatric', icon: '✧' },
    { key: 'time', label: 'Time & Conversion', icon: '◷' }
  ];

  let inMemoryFavorites = [];
  let selectedView = 'all';
  let sidebarResults = null;
  let sidebarTitle = null;
  let sidebarButtons = [];
  let originalSidebarLinks = new Map();
  let mobilePanel = null;
  let mobileToggle = null;
  let mobileView = 'favorites';
  let headerStar = null;

  function readFavorites() {
    let stored;
    try {
      stored = window.localStorage.getItem(favoriteStorageKey);
    } catch (_) {
      return inMemoryFavorites.slice();
    }
    try {
      const parsed = JSON.parse(stored || '[]');
      if (!Array.isArray(parsed)) return [];
      const valid = parsed.filter(path => typeof path === 'string' && byPath.has(path));
      return [...new Set(valid)].slice(0, registry.length);
    } catch (_) {
      return [];
    }
  }

  function saveFavorites(routes) {
    const valid = [...new Set(routes)].filter(path => byPath.has(path));
    inMemoryFavorites = valid;
    try {
      window.localStorage.setItem(favoriteStorageKey, JSON.stringify(valid));
    } catch (_) {
      // In private or restricted browsers, favorites work for this page only.
    }
  }

  function recentTools() {
    try {
      const api = window.PerfusionToolsRecentCalculators;
      const routes = api && api.readRecentCalculatorRoutes ? api.readRecentCalculatorRoutes() : [];
      return routes.filter(path => byPath.has(path)).map(path => byPath.get(path));
    } catch (_) {
      return [];
    }
  }

  function selectedTools() {
    if (selectedView === 'favorites') {
      return readFavorites().map(path => byPath.get(path)).filter(Boolean);
    }
    if (selectedView === 'recent') return recentTools();
    if (selectedView === 'all') return registry;
    return registry.filter(tool => tool.category === selectedView);
  }

  function updateStarStates() {
    const favorites = new Set(readFavorites());
    document.querySelectorAll('[data-pt-favorite-path]').forEach(button => {
      const tool = byPath.get(button.getAttribute('data-pt-favorite-path'));
      if (!tool) return;
      const selected = favorites.has(tool.path);
      const action = selected ? 'Remove from favorites: ' : 'Add to favorites: ';
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', action + tool.title);
      button.title = action + tool.title;
    });
  }

  function toggleFavorite(path) {
    if (!byPath.has(path)) return;
    const favorites = readFavorites();
    saveFavorites(favorites.includes(path)
      ? favorites.filter(saved => saved !== path) : [...favorites, path]);
    refreshWorkspace();
  }

  function starButton(path, extraClass) {
    const tool = byPath.get(path);
    if (!tool) return null;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pt-favorite-button ' + (extraClass || '');
    button.setAttribute('data-pt-favorite-path', path);
    button.innerHTML = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.5l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9L12 3z"/></svg>';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite(button.getAttribute('data-pt-favorite-path'));
    });
    return button;
  }

  function toolEntry(tool, reuseOriginalLink) {
    const item = document.createElement('div');
    item.className = 'pt-sidebar-tool-entry';
    const link = reuseOriginalLink || document.createElement('a');
    link.href = tool.path;
    link.className = 'sidebar-link pt-sidebar-tool-link';
    link.textContent = tool.title;
    if (window.location.pathname === tool.path || window.location.pathname === tool.path.slice(0, -1)) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
    item.append(link, starButton(tool.path, 'pt-sidebar-star'));
    return item;
  }

  function heading(text) {
    const label = document.createElement('p');
    label.className = 'pt-sidebar-label';
    label.textContent = text;
    return label;
  }

  function sidebarOption(key, label, icon) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pt-sidebar-option';
    button.setAttribute('data-pt-sidebar-view', key);
    const symbol = document.createElement('span');
    symbol.className = 'pt-sidebar-symbol';
    symbol.textContent = icon;
    symbol.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.textContent = label;
    button.append(symbol, name);
    button.addEventListener('click', () => {
      selectedView = key;
      try { window.sessionStorage.setItem(sidebarStorageKey, key); } catch (_) {}
      renderSidebar();
    });
    sidebarButtons.push(button);
    return button;
  }

  function setupSidebar() {
    const aside = document.getElementById('desktop-sidebar');
    if (!aside || !registry.length) return;
    const originalLinks = Array.from(aside.querySelectorAll('a[href]'));
    const homeLink = originalLinks.find(a => a.getAttribute('href') === '/');
    const infoLink = originalLinks.find(a => (a.getAttribute('href') || '').startsWith('/info'));
    originalSidebarLinks = new Map(originalLinks
      .filter(link => byPath.has(link.getAttribute('href')))
      .map(link => [link.getAttribute('href'), link]));

    try {
      const stored = window.sessionStorage.getItem(sidebarStorageKey);
      if (['favorites', 'recent', ...categories.map(category => category.key)].includes(stored)) {
        selectedView = stored;
      }
    } catch (_) {}

    const nav = document.createElement('nav');
    nav.className = 'pt-sidebar-workspace';
    nav.setAttribute('aria-label', 'Browse tools and saved tools');
    nav.appendChild(heading('Browse tools'));
    categories.forEach(category => {
      nav.appendChild(sidebarOption(category.key, category.label, category.icon));
    });
    nav.appendChild(heading('Your space'));
    nav.appendChild(sidebarOption('favorites', 'Favorites', '★'));
    nav.appendChild(sidebarOption('recent', 'Recently used', '◷'));

    const results = document.createElement('section');
    results.className = 'pt-sidebar-results';
    results.setAttribute('aria-label', 'Selected calculator list');
    const title = document.createElement('p');
    title.className = 'pt-sidebar-results-title';
    const list = document.createElement('div');
    list.id = 'pt-sidebar-result-list';
    list.className = 'pt-sidebar-list';
    results.append(title, list);
    nav.appendChild(results);
    sidebarResults = list;
    sidebarTitle = title;

    const links = document.createElement('div');
    links.className = 'pt-sidebar-footer';
    if (homeLink) {
      homeLink.className = 'sidebar-link pt-sidebar-footer-link';
      homeLink.textContent = 'Home';
      links.appendChild(homeLink);
    }
    if (infoLink) {
      infoLink.className = 'sidebar-link pt-sidebar-footer-link';
      infoLink.textContent = 'About';
      links.appendChild(infoLink);
    }
    nav.appendChild(links);
    aside.replaceChildren(nav);
    renderSidebar();
  }

  function renderSidebar() {
    if (!sidebarResults || !sidebarTitle) return;
    sidebarButtons.forEach(button => {
      button.setAttribute('aria-pressed',
        String(button.getAttribute('data-pt-sidebar-view') === selectedView));
    });
    const items = selectedTools();
    const choice = categories.find(category => category.key === selectedView);
    const label = choice ? choice.label : (selectedView === 'favorites' ? 'Favorites' : 'Recently used');
    sidebarTitle.textContent = label + ' · ' + items.length;
    const rows = items.map(tool => toolEntry(tool, originalSidebarLinks.get(tool.path)));
    sidebarResults.replaceChildren(...rows);
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'pt-sidebar-empty';
      empty.textContent = selectedView === 'favorites'
        ? 'No favorites yet. Select a star on a calculator.'
        : 'No recent calculators in this browser.';
      sidebarResults.appendChild(empty);
    }
    updateStarStates();
  }

  function decorateHomeCards() {
    document.querySelectorAll(
      '#featured-calculator-list li, #calculator-category-list li, #recent-calculator-list li'
    ).forEach(item => {
      if (item.querySelector('.pt-card-star')) return;
      const link = item.querySelector('a[href]');
      if (!link) return;
      const path = link.getAttribute('href');
      if (!byPath.has(path)) return;
      const star = starButton(path, 'pt-card-star');
      if (!star) return;
      item.classList.add('pt-favorite-card-wrap');
      item.appendChild(star);
    });
    updateStarStates();
  }

  function currentTool() {
    const path = window.location.pathname;
    return registry.find(tool => tool.path === path || tool.path.slice(0, -1) === path) || null;
  }

  function updateHeaderStar() {
    if (!headerStar) return;
    const tool = currentTool();
    headerStar.hidden = !tool;
    if (tool) headerStar.setAttribute('data-pt-favorite-path', tool.path);
    updateStarStates();
  }

  function mobileLinks() {
    if (!mobilePanel) return;
    const results = mobilePanel.querySelector('#pt-mobile-workspace-results');
    if (!results) return;
    mobilePanel.querySelectorAll('[data-pt-mobile-view]').forEach(button => {
      button.setAttribute('aria-pressed',
        String(button.getAttribute('data-pt-mobile-view') === mobileView));
    });
    const tools = mobileView === 'favorites'
      ? readFavorites().map(path => byPath.get(path)).filter(Boolean) : recentTools();
    results.replaceChildren();
    if (!tools.length) {
      const empty = document.createElement('p');
      empty.className = 'pt-sidebar-empty';
      empty.textContent = mobileView === 'favorites'
        ? 'No favorites yet. Star a calculator to add one.'
        : 'Your recently used calculators appear here.';
      results.appendChild(empty);
      return;
    }
    tools.forEach(tool => {
      const item = document.createElement('div');
      item.className = 'pt-mobile-workspace-item';
      const link = document.createElement('a');
      link.href = tool.path;
      link.textContent = tool.title;
      item.appendChild(link);
      if (mobileView === 'favorites') item.appendChild(starButton(tool.path, 'pt-sidebar-star'));
      results.appendChild(item);
    });
    updateStarStates();
  }

  function closeMobilePanel(restoreFocus) {
    if (!mobilePanel || !mobileToggle) return;
    mobilePanel.hidden = true;
    mobileToggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) mobileToggle.focus();
  }

  function setupHeaderTools() {
    const themeButton = document.getElementById('theme-toggle');
    const headerRow = themeButton && themeButton.parentElement;
    if (!headerRow || !registry.length) return;
    const star = starButton(registry[0].path, 'pt-header-favorite');
    star.hidden = true;
    headerRow.insertBefore(star, themeButton);
    headerStar = star;
    updateHeaderStar();

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pt-mobile-workspace-toggle md:hidden';
    button.setAttribute('aria-label', 'Open my tools');
    button.setAttribute('aria-controls', 'pt-mobile-workspace-panel');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M5 5h14v15l-7-4-7 4z"/></svg>';
    headerRow.insertBefore(button, themeButton);
    mobileToggle = button;

    const panel = document.createElement('section');
    panel.id = 'pt-mobile-workspace-panel';
    panel.className = 'pt-mobile-workspace-panel md:hidden';
    panel.setAttribute('aria-label', 'My saved and recent tools');
    panel.hidden = true;
    const tabs = document.createElement('div');
    tabs.className = 'pt-mobile-workspace-tabs';
    for (const view of ['favorites', 'recent']) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.setAttribute('data-pt-mobile-view', view);
      tab.textContent = view === 'favorites' ? '★ Favorites' : '◷ Recently used';
      tab.addEventListener('click', () => {
        mobileView = view;
        mobileLinks();
      });
      tabs.appendChild(tab);
    }
    const results = document.createElement('div');
    results.id = 'pt-mobile-workspace-results';
    results.className = 'pt-mobile-workspace-results';
    panel.append(tabs, results);
    document.body.appendChild(panel);
    mobilePanel = panel;

    button.addEventListener('click', () => {
      const opening = panel.hidden;
      panel.hidden = !opening;
      button.setAttribute('aria-expanded', String(opening));
      if (opening) mobileLinks();
    });
    document.addEventListener('click', event => {
      if (!panel.hidden && !panel.contains(event.target) && !button.contains(event.target)) {
        closeMobilePanel(false);
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) closeMobilePanel(true);
    });
  }

  function refreshWorkspace() {
    renderSidebar();
    decorateHomeCards();
    updateHeaderStar();
    if (mobilePanel && !mobilePanel.hidden) mobileLinks();
  }

  function initialize() {
    if (!registry.length) return;
    setupSidebar();
    setupHeaderTools();
    decorateHomeCards();
    // The SPA can populate Home when navigating back from an informational view.
    const home = document.getElementById('view-home');
    if (home && typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => decorateHomeCards());
      observer.observe(home, { childList: true, subtree: true });
    }
    window.addEventListener('pageshow', refreshWorkspace);
    window.addEventListener('popstate', refreshWorkspace);
    window.addEventListener('storage', event => {
      if (event.key === favoriteStorageKey || event.key === recentStorageKey) refreshWorkspace();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  window.PerfusionToolsFavorites = {
    readFavorites,
    toggleFavorite,
    favoriteStorageKey
  };
})();
