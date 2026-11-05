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
  let storageWriteFailed = false;
  let selectedView = 'none';
  let lastRenderedView = null;
  let sidebarResults = null;
  let sidebarTitle = null;
  let sidebarPanel = null;
  let sidebarButtons = [];
  let originalSidebarLinks = new Map();
  let sidebarFooterLinks = [];
  let mobilePanel = null;
  let mobileToggle = null;
  let mobileView = 'favorites';
  let pageStar = null;

  function readFavorites() {
    if (storageWriteFailed) return inMemoryFavorites.slice();
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
      storageWriteFailed = false;
    } catch (_) {
      storageWriteFailed = true;
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
    button.setAttribute('aria-controls', 'pt-sidebar-inline-panel');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => {
      selectedView = selectedView === key ? 'none' : key;
      try {
        if (selectedView === 'none') window.sessionStorage.removeItem(sidebarStorageKey);
        else window.sessionStorage.setItem(sidebarStorageKey, selectedView);
      } catch (_) {}
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
    results.id = 'pt-sidebar-inline-panel';
    results.className = 'pt-sidebar-results pt-sidebar-inline-results';
    results.setAttribute('aria-label', 'Expanded calculator list');
    const title = document.createElement('p');
    title.className = 'pt-sidebar-results-title';
    const list = document.createElement('div');
    list.id = 'pt-sidebar-result-list';
    list.className = 'pt-sidebar-list';
    results.append(title, list);
    nav.appendChild(results);
    sidebarResults = list;
    sidebarTitle = title;
    sidebarPanel = results;

    const links = document.createElement('div');
    links.className = 'pt-sidebar-footer';
    const appendFooterLink = (link, label, symbol) => {
      if (!link) return;
      link.className = 'sidebar-link pt-sidebar-footer-link';
      link.replaceChildren();
      const icon = document.createElement('span');
      icon.className = 'pt-sidebar-symbol';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = symbol;
      const text = document.createElement('span');
      text.textContent = label;
      link.append(icon, text);
      links.appendChild(link);
    };
    appendFooterLink(homeLink, 'Home', '⌂');
    appendFooterLink(infoLink, 'About', 'ⓘ');
    sidebarFooterLinks = [homeLink, infoLink].filter(Boolean);
    nav.appendChild(links);
    aside.replaceChildren(nav);
    renderSidebar();
  }

  function renderSidebar() {
    if (!sidebarResults || !sidebarTitle || !sidebarPanel) return;
    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
    sidebarFooterLinks.forEach(link => {
      const href = link.getAttribute('href');
      const active = href === '/' ? (currentPath === '/' || currentPath === '/index.html')
        : href.startsWith('/info') && currentPath === '/info';
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    let activeButton = null;
    sidebarButtons.forEach(button => {
      const expanded = button.getAttribute('data-pt-sidebar-view') === selectedView;
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute('aria-pressed', String(expanded));
      if (expanded) activeButton = button;
    });
    // The same list follows its category, Favorites, or Recently used trigger.
    const viewChanged = lastRenderedView !== null && lastRenderedView !== selectedView;
    lastRenderedView = selectedView;
    sidebarPanel.hidden = !activeButton;
    if (activeButton) activeButton.after(sidebarPanel);
    if (!activeButton) {
      sidebarResults.replaceChildren();
      updateStarStates();
      return;
    }
    const items = selectedTools();
    const choice = categories.find(category => category.key === selectedView);
    const label = choice ? choice.label : (selectedView === 'favorites' ? 'Favorites' : 'Recently used');
    sidebarTitle.textContent = label;
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
    // Animate only genuine category transitions; ordinary favorites/route
    // refreshes must not repeatedly animate or add extra layout work.
    const reducedMotion = typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (viewChanged && !reducedMotion && typeof sidebarPanel.animate === 'function') {
      sidebarPanel.animate(
        [{ opacity: 0, transform: 'translateY(-8px)' },
         { opacity: 1, transform: 'translateY(0)' }],
        { duration: 180, easing: 'cubic-bezier(.2,.7,.2,1)' }
      );
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

  function updatePageStar() {
    if (!pageStar) return;
    const tool = currentTool();
    pageStar.hidden = !tool;
    if (tool) pageStar.setAttribute('data-pt-favorite-path', tool.path);
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
    const pageHeading = document.getElementById('page-heading');
    if (pageHeading) {
      const titleRow = document.createElement('div');
      titleRow.className = 'pt-calculator-title-row';
      pageHeading.parentElement.insertBefore(titleRow, pageHeading);
      const star = starButton(registry[0].path, 'pt-page-favorite');
      star.hidden = true;
      titleRow.append(pageHeading, star);
      pageStar = star;
      updatePageStar();
    }
    const controls = document.createElement('div');
    controls.className = 'pt-header-controls';
    headerRow.insertBefore(controls, themeButton);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pt-mobile-workspace-toggle md:hidden';
    button.setAttribute('aria-label', 'Open my tools');
    button.setAttribute('aria-controls', 'pt-mobile-workspace-panel');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M5 5h14v15l-7-4-7 4z"/></svg>';
    controls.append(button, themeButton);
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
      if (opening) {
        mobileLinks();
        const firstTab = panel.querySelector('[data-pt-mobile-view="favorites"]');
        if (firstTab) firstTab.focus();
      }
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
    updatePageStar();
    if (mobilePanel && !mobilePanel.hidden) mobileLinks();
  }

  function initialize() {
    if (!registry.length) return;
    setupSidebar();
    setupHeaderTools();
    decorateHomeCards();
    const pageHeading = document.getElementById('page-heading');
    if (pageHeading && typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(updatePageStar);
      observer.observe(pageHeading, { childList: true, characterData: true, subtree: true });
    }
    // The SPA can populate Home when navigating back from an informational view.
    const home = document.getElementById('view-home');
    if (home && typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => refreshWorkspace());
      observer.observe(home, { childList: true, subtree: true });
    }
    document.addEventListener('click', event => {
      if (event.target.closest('#clear-recent-calculators')) {
        window.setTimeout(refreshWorkspace, 0);
      }
    });
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
