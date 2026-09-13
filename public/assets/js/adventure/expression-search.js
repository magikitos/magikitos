"use strict";
(function () {
  function t(key, fallback) {
    return window.ExpresionarioConfig?.strings?.[key] || fallback;
  }
  let ExpConfig = window.ExpresionarioConfig || {};
  let pending;
  document.addEventListener("world:unmount", () => pending?.abort());
  function initSearch() {
    const searchForm = document.getElementById("expr-live-search");
    const searchInput = document.getElementById("expr-live-search__input");
    const searchResults = document.getElementById("expr-live-search__results");

    if (
      !searchForm ||
      !searchInput ||
      !searchResults ||
      searchForm.dataset.mounted
    )
      return;
    searchForm.dataset.mounted = "1";

    // Perform search on page load if query exists
    const initialQuery = ExpConfig.initialQuery;
    if (initialQuery && initialQuery.trim()) {
      performSearch(initialQuery.trim(), searchResults);
    }

    // Handle form submission
    searchForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const query = searchInput.value.trim();

      if (!query) {
        searchResults.innerHTML = `
                    <div class="expressionario-empty-state">
                        <i class="fa-solid fa-search"></i>
                        <p>${t("searchMinChars", "Escribe algo para empezar a buscar")}</p>
                    </div>
                `;
        return;
      }

      performSearch(query, searchResults);
    });
  }

  async function performSearch(query, resultsContainer) {
    pending?.abort();
    const request = new AbortController();
    pending = request;
    // Show loading state
    resultsContainer.innerHTML = `
            <div class="expressionario-loading">
                <i class="fa-solid fa-circle-notch fa-spin"></i>
                <p>${t("loading", "Buscando...")}</p>
            </div>
        `;

    try {
      const response = await fetch(
        `${ExpConfig.searchEndpoint || "/api/expressionario/search"}?lang=${encodeURIComponent(ExpConfig.langKey)}&q=${encodeURIComponent(query)}`,
        { signal: request.signal },
      );
      const data = await response.json();

      if (request.signal.aborted || !resultsContainer.isConnected) return;
      if (!data.success) {
        resultsContainer.innerHTML = `
                    <div class="expressionario-error">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <p>${escapeHtml(data.error || t("searchError", "Error"))}</p>
                    </div>
                `;
        return;
      }

      if (data.count === 0) {
        resultsContainer.innerHTML = `
                    <div class="expressionario-empty-state">
                        <i class="fa-solid fa-search"></i>
                        <p>${t("searchNoResults", "No se encontraron resultados para").replace("{query}", '"<strong>' + escapeHtml(query) + '</strong>"')}</p>
                        <p>${t("searchNoResultsHint", "Prueba con otras palabras o navega por las regiones")}</p>
                    </div>
                `;
        return;
      }

      // Display results
      resultsContainer.innerHTML = `
                <div class="expressionario-search-header">
                    <p>${t(
                      "searchResultsFound",
                      "Se encontraron {count} resultados para {query}",
                    )
                      .replace("{count}", "<strong>" + data.count + "</strong>")
                      .replace(
                        "{query}",
                        '"<strong>' + escapeHtml(query) + '</strong>"',
                      )}</p>
                </div>
                <div class="expressionario-terms-grid">
                    ${data.results.join("")}
                </div>
            `;
    } catch (error) {
      if (error.name === "AbortError" || !resultsContainer.isConnected) return;
      resultsContainer.innerHTML = `
                <div class="expressionario-error">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <p>${t("connectionError", "Error")}</p>
                </div>
            `;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function mount() {
    ExpConfig = window.ExpresionarioConfig || {};
    initSearch();
  }
  document.addEventListener("world:mount", mount);
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
