(() => {
  const RESULTS_PER_PAGE = 18;
  const LEVEL_ORDER = { S1: 1, S2: 2, S3: 3, S4: 4, S5: 5, S6: 6 };

  const state = {
    all: [],
    filtered: [],
    activeLevels: new Set(),
    shown: 0,
    query: "",
  };

  const els = {
    form: document.getElementById("search-form"),
    input: document.getElementById("topic-input"),
    results: document.getElementById("results"),
    statusLine: document.getElementById("status-line"),
    metaLine: document.getElementById("meta-line"),
    loadMoreWrap: document.getElementById("load-more-wrap"),
    loadMore: document.getElementById("load-more"),
    chips: Array.from(document.querySelectorAll(".chip[data-level]")),
    chipReset: document.getElementById("chip-reset"),
  };

  function stopWord(word) {
    const stop = new Set([
      "dan", "di", "ke", "dari", "yang", "untuk", "pada", "atau",
      "the", "of", "and", "for", "in", "on", "a", "an",
    ]);
    return stop.has(word);
  }

  function tokenize(text) {
    return (text || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stopWord(w));
  }

  function scoreJournal(journal, queryTokens, rawQuery) {
    const title = (journal.title || "").toLowerCase();
    const subject = (journal.subject_area || "").toLowerCase();
    let score = 0;

    if (rawQuery && title.includes(rawQuery)) score += 30;

    for (const tok of queryTokens) {
      if (title.includes(tok)) score += 10;
      if (subject.includes(tok)) score += 5;
    }
    return score;
  }

  function levelRank(level) {
    return LEVEL_ORDER[level] || 99;
  }

  function runSearch(rawQuery) {
    const query = rawQuery.trim().toLowerCase();
    state.query = query;
    const tokens = tokenize(query);

    let candidates = state.all;

    if (state.activeLevels.size > 0) {
      candidates = candidates.filter((j) => state.activeLevels.has(j.sinta_level));
    }

    if (query.length === 0) {
      state.filtered = candidates
        .slice()
        .sort((a, b) => levelRank(a.sinta_level) - levelRank(b.sinta_level) || a.title.localeCompare(b.title));
    } else {
      state.filtered = candidates
        .map((j) => ({ j, score: scoreJournal(j, tokens, query) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || levelRank(a.j.sinta_level) - levelRank(b.j.sinta_level))
        .map((x) => x.j);
    }

    state.shown = 0;
    renderStatus();
    els.results.innerHTML = "";
    appendResults();
  }

  function renderStatus() {
    const q = state.query;
    const count = state.filtered.length;
    els.statusLine.hidden = false;
    if (q.length === 0 && state.activeLevels.size === 0) {
      els.statusLine.textContent = `Menampilkan seluruh katalog (${count.toLocaleString("id-ID")} jurnal). Tulis topik di atas untuk mempersempit pencarian.`;
    } else {
      const levelNote = state.activeLevels.size
        ? ` · saring: ${Array.from(state.activeLevels).sort().join(", ")}`
        : "";
      els.statusLine.textContent = q
        ? `${count.toLocaleString("id-ID")} jurnal cocok dengan topik "${q}"${levelNote}`
        : `${count.toLocaleString("id-ID")} jurnal${levelNote}`;
    }
  }

  function stampClass(level) {
    if (!level) return "none";
    const l = level.toLowerCase();
    return ["s1", "s2", "s3", "s4", "s5", "s6"].includes(l) ? l : "none";
  }

  function cardTemplate(journal, index) {
    const level = journal.sinta_level || "—";
    const cls = stampClass(journal.sinta_level);
    const subject = journal.subject_area ? journal.subject_area : "Bidang tidak tercatat";
    const website = journal.website && journal.website !== "#!" ? journal.website : null;

    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="card-top">
        <span class="card-index">No. ${String(index + 1).padStart(3, "0")}</span>
      </div>
      <div class="card-top">
        <h3 class="card-title">
          <a href="${journal.profile_url}" target="_blank" rel="noopener">${escapeHtml(journal.title)}</a>
        </h3>
        <span class="stamp ${cls}" title="Tingkat akreditasi Sinta">${escapeHtml(level)}</span>
      </div>
      <p class="card-subject">${escapeHtml(subject)}</p>
      <div class="card-meta">
        ${website ? `<a href="${website}" target="_blank" rel="noopener">Situs jurnal ↗</a>` : `<span>Situs tidak tercatat</span>`}
        ${journal.scopus_indexed ? `<span class="badge-index">Scopus</span>` : ""}
        ${journal.garuda_indexed ? `<span class="badge-index">Garuda</span>` : ""}
        ${journal.issn_e ? `<span>E-ISSN ${escapeHtml(journal.issn_e)}</span>` : ""}
      </div>
    `;
    return card;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function appendResults() {
    const next = state.filtered.slice(state.shown, state.shown + RESULTS_PER_PAGE);

    if (state.filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = state.query
        ? `Tidak ada laci katalog yang cocok dengan "${state.query}". Coba kata kunci lain, atau kosongkan saringan tingkat Sinta.`
        : "Belum ada data jurnal untuk ditampilkan.";
      els.results.appendChild(empty);
      els.loadMoreWrap.hidden = true;
      return;
    }

    next.forEach((journal, i) => {
      els.results.appendChild(cardTemplate(journal, state.shown + i));
    });
    state.shown += next.length;

    els.loadMoreWrap.hidden = state.shown >= state.filtered.length;
  }

  function toggleChip(chip) {
    const level = chip.dataset.level;
    if (state.activeLevels.has(level)) {
      state.activeLevels.delete(level);
      chip.classList.remove("active");
    } else {
      state.activeLevels.add(level);
      chip.classList.add("active");
    }
    runSearch(els.input.value);
  }

  async function init() {
    els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      runSearch(els.input.value);
    });

    let debounceTimer;
    els.input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => runSearch(els.input.value), 220);
    });

    els.chips.forEach((chip) => chip.addEventListener("click", () => toggleChip(chip)));
    els.chipReset.addEventListener("click", () => {
      state.activeLevels.clear();
      els.chips.forEach((c) => c.classList.remove("active"));
      runSearch(els.input.value);
    });

    els.loadMore.addEventListener("click", appendResults);

    try {
      const [journalsRes, metaRes] = await Promise.all([
        fetch("data/journals.json"),
        fetch("data/meta.json").catch(() => null),
      ]);
      state.all = await journalsRes.json();

      if (metaRes && metaRes.ok) {
        const meta = await metaRes.json();
        const when = meta.last_updated === "seed-data"
          ? "data contoh awal — jalankan GitHub Action untuk mengambil data lengkap"
          : new Date(meta.last_updated).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
        els.metaLine.textContent = `Katalog berisi ${meta.total_journals.toLocaleString("id-ID")} jurnal · diperbarui ${when}`;
      } else {
        els.metaLine.textContent = `Katalog berisi ${state.all.length.toLocaleString("id-ID")} jurnal`;
      }
    } catch (err) {
      els.metaLine.textContent = "Gagal memuat data katalog. Periksa apakah data/journals.json tersedia.";
      console.error(err);
    }

    runSearch("");
  }

  init();
})();
