(() => {
  const RESULTS_PER_PAGE = 18;
  const LEVEL_ORDER = { S1: 1, S2: 2, S3: 3, S4: 4, S5: 5, S6: 6 };

  // Sinta mencatat bidang subjek jurnal dalam bahasa Inggris (mis. "Agriculture",
  // "Health", "Education"). Peta ini menerjemahkan kata kunci topik berbahasa
  // Indonesia yang umum ke label subjek tersebut, supaya pencarian "pertanian"
  // tetap menemukan jurnal berlabel "Agriculture" walau judulnya tidak
  // mengandung kata "pertanian".
  const SUBJECT_SYNONYMS = {
    pertanian: ["agriculture", "agricultural", "agro", "farming"],
    pangan: ["agriculture", "food"],
    agribisnis: ["agriculture", "economy", "business", "agribusiness"],
    agroindustri: ["agriculture", "engineering", "industry"],
    komoditas: ["agriculture", "economy"],
    tanaman: ["agriculture", "plant"],
    perkebunan: ["agriculture", "plantation"],
    budidaya: ["agriculture", "cultivation"],
    gizi: ["health", "nutrition", "food"],
    pascapanen: ["agriculture", "food"],
    peternakan: ["agriculture", "animal", "veterinary"],
    perikanan: ["agriculture", "fisheries", "marine"],
    kehutanan: ["agriculture", "forestry"],
    kesehatan: ["health", "medicine", "medical", "nursing", "pharmacy"],
    kedokteran: ["health", "medicine", "medical"],
    keperawatan: ["health", "nursing"],
    farmasi: ["health", "pharmacy"],
    pendidikan: ["education"],
    pengajaran: ["education"],
    ekonomi: ["economy", "economics", "business", "finance", "management"],
    bisnis: ["economy", "business", "management"],
    akuntansi: ["economy", "accounting"],
    manajemen: ["economy", "management"],
    teknik: ["engineering"],
    rekayasa: ["engineering"],
    komputer: ["engineering", "science", "computer", "informatics"],
    informatika: ["engineering", "science", "computer", "informatics"],
    hukum: ["social", "law"],
    sosial: ["social"],
    politik: ["social", "politics"],
    komunikasi: ["social", "communication"],
    psikologi: ["social", "health", "psychology"],
    agama: ["religion"],
    islam: ["religion"],
    kristen: ["religion"],
    filsafat: ["humanities", "religion", "philosophy"],
    budaya: ["humanities", "art", "culture"],
    bahasa: ["humanities", "education", "linguistics"],
    sastra: ["humanities", "art", "literature"],
    seni: ["art"],
    sains: ["science"],
    fisika: ["science", "physics"],
    kimia: ["science", "chemistry"],
    biologi: ["science", "biology"],
    matematika: ["science", "mathematics"],
    lingkungan: ["science", "engineering", "environment"],
    geografi: ["science", "geography", "geospatial", "geomatics"],
  };

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

    tabBtnSearch: document.getElementById("tab-btn-search"),
    tabBtnPredictor: document.getElementById("tab-btn-predictor"),
    panelSearch: document.getElementById("panel-search"),
    panelPredictor: document.getElementById("panel-predictor"),
    searchResultsWrap: document.getElementById("search-results-wrap"),
    predictorResultsWrap: document.getElementById("predictor-results-wrap"),

    predictorForm: document.getElementById("predictor-form"),
    draftInput: document.getElementById("draft-input"),
    predictorReport: document.getElementById("predictor-report"),
    predictorStatus: document.getElementById("predictor-status"),
    predictorRecs: document.getElementById("predictor-recs"),
  };

  function stopWord(word) {
    const stop = new Set([
      "dan", "di", "ke", "dari", "yang", "untuk", "pada", "atau", "ini", "itu",
      "dengan", "dalam", "adalah", "dapat", "akan", "juga", "oleh", "sebagai",
      "tersebut", "secara", "telah", "sangat", "lebih", "para", "kami", "penulis",
      "hasil", "penelitian", "artikel", "jurnal", "data", "menggunakan", "metode",
      "abstrak", "kata", "kunci", "pendahuluan", "kesimpulan", "pembahasan",
      // kata metodologi/akademik generik — bukan topik, sering muncul di semua
      // bidang sekaligus kebetulan jadi bagian nama banyak jurnal yang tidak
      // berhubungan (mis. "Analisis: Jurnal Studi Keislaman").
      "analisis", "analisa", "kajian", "studi", "tinjauan", "identifikasi",
      "evaluasi", "implementasi", "penerapan", "pengembangan", "perbandingan",
      "pengaruh", "hubungan", "korelasi", "dampak", "faktor", "peningkatan",
      "pemanfaatan", "berbasis", "berdasarkan", "terhadap", "deskriptif",
      "kuantitatif", "kualitatif", "sampel", "populasi", "variabel",
      "signifikan", "pengujian", "pengukuran", "karakteristik", "nilai",
      "tingkat", "sistem", "model", "proses", "aspek", "upaya", "strategi",
      "dilakukan", "melakukan", "menunjukkan", "menghasilkan", "memiliki",
      "terdapat", "diperoleh", "didapatkan", "berupa", "digunakan", "diketahui",
      "the", "of", "and", "for", "in", "on", "a", "an", "is", "are", "was", "were",
      "this", "that", "with", "study", "research", "paper", "article", "using",
      "method", "results", "abstract", "keywords", "introduction", "conclusion",
      "analysis", "based", "effect", "influence", "level", "factor",
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
    const description = (journal.description || "").toLowerCase();

    let titleScore = 0;
    let contextScore = 0; // subjek/bidang/deskripsi — sinyal sekunder, bobot kecil

    // Cocok utuh satu frasa di judul = sinyal terkuat.
    if (rawQuery && rawQuery.length > 2 && title.includes(rawQuery)) {
      titleScore += 60;
    }

    let tokensMatchedInTitle = 0;
    for (const tok of queryTokens) {
      // Kata utuh (word boundary), bukan potongan huruf di tengah kata lain,
      // supaya "seni" tidak nyangkut di "kesenian" secara kebetulan longgar,
      // dst — mencocokkan kata sebagai satu unit penuh.
      const wordRe = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(tok)}([^\\p{L}\\p{N}]|$)`, "u");
      if (wordRe.test(title)) {
        titleScore += 22;
        tokensMatchedInTitle += 1;
      }
      if (description && wordRe.test(description)) {
        contextScore += 6;
      }
      if (subject.includes(tok)) contextScore += 3;

      const synonyms = SUBJECT_SYNONYMS[tok];
      if (synonyms) {
        for (const syn of synonyms) {
          if (subject.includes(syn)) contextScore += 1.5;
        }
      }
    }

    // Bonus kalau SEMUA kata kunci ketemu di judul (bukan cuma sebagian).
    if (queryTokens.length > 1 && tokensMatchedInTitle === queryTokens.length) {
      titleScore += 25;
    }

    // Judul adalah sinyal utama; bidang subjek/deskripsi cuma penentu urutan
    // kalau skor judul sama, bukan pendorong utama supaya jurnal yang cuma
    // "bidangnya mirip" tidak menyalip jurnal yang judulnya benar-benar cocok.
    return titleScore * 10 + contextScore;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  // ===== Tab switching =====
  function switchTab(tab) {
    const isSearch = tab === "search";
    els.tabBtnSearch.classList.toggle("active", isSearch);
    els.tabBtnPredictor.classList.toggle("active", !isSearch);
    els.tabBtnSearch.setAttribute("aria-selected", String(isSearch));
    els.tabBtnPredictor.setAttribute("aria-selected", String(!isSearch));
    els.panelSearch.hidden = !isSearch;
    els.panelPredictor.hidden = isSearch;
    els.searchResultsWrap.hidden = !isSearch;
    els.predictorResultsWrap.hidden = isSearch;
  }

  // ===== Draft analysis (heuristik, bukan penilaian resmi) =====
  // Peta label level -> kode Sinta yang akan dipakai untuk mencari rekomendasi jurnal.
  const LEVEL_TO_CODES = {
    "SINTA 1": ["S1"],
    "SINTA 2": ["S2"],
    "SINTA 3-4": ["S3", "S4"],
    "SINTA 5-6": ["S5", "S6"],
  };

  function analyzeDraftText(text) {
    const lowerText = text.toLowerCase();
    const words = text.trim().split(/\s+/).length;

    const sections = {
      intro: /introduction|pendahuluan/.test(lowerText),
      method: /method|metode/.test(lowerText),
      results: /result|hasil/.test(lowerText),
      discussion: /discussion|pembahasan/.test(lowerText),
      conclusion: /conclusion|kesimpulan/.test(lowerText),
    };
    const sectionCount = Object.values(sections).filter(Boolean).length;

    const isEnglish =
      /abstract|research|background/.test(lowerText) &&
      !/abstrak|penelitian|latar belakang/.test(lowerText);

    const citationPattern = /\[[\d, \-]+\]|\(\b(?:[A-Z][a-z]+(?:\s+et\s+al\.)?|[\w\s,]+)\s*,\s*\d{4}\)|\(\d{4}\)/g;
    const allMatches = text.match(citationPattern) || [];
    const refsCount = new Set(allMatches).size;

    let score = 0;
    if (isEnglish) score += 25;
    if (words > 3000) score += 20;
    else if (words > 1500) score += 10;

    if (refsCount > 20) score += 30;
    else if (refsCount > 10) score += 15;
    else score += 5;

    if (sectionCount >= 4) score += 25;

    let level = "SINTA 5-6";
    let color = "#64748b";
    let advice = "Draf artikel memenuhi kriteria dasar. Fokus pada penguatan gap penelitian dan perbanyak referensi jurnal internasional terbaru.";

    if (score >= 80) {
      level = "SINTA 1";
      color = "#9B3B34";
      advice = "Struktur dan bobot artikel sudah mendekati standar bereputasi tinggi. Berpotensi untuk jurnal Sinta 1 / terindeks Scopus.";
    } else if (score >= 65) {
      level = "SINTA 2";
      color = "#B8862F";
      advice = "Sudah cukup kuat. Perdalam bagian pembahasan (discussion) untuk memperkuat kontribusi substansi.";
    } else if (score >= 50) {
      level = "SINTA 3-4";
      color = "#3E5C63";
      advice = "Kualitas draf setara standar nasional terakreditasi menengah. Perkuat kemutakhiran referensi.";
    }

    return {
      score, level, color, advice, words, sectionCount, refsCount,
      acceptedLevels: LEVEL_TO_CODES[level] || ["S5", "S6"],
    };
  }

  // Cari baris "Kata kunci : ..." atau "Keywords : ..." — ini kata kunci resmi
  // yang ditulis penulisnya sendiri, jauh lebih akurat menggambarkan topik
  // dibanding kata yang cuma sering diulang di badan teks.
  function extractExplicitKeywordPhrases(text) {
    const lines = text.split(/\r?\n/);
    const phrases = [];
    for (const line of lines) {
      const m = line.match(/^\s*(?:kata\s*kunci|keywords?)\s*[:\-]\s*(.+)$/i);
      if (m) {
        phrases.push(...m[1].split(/[,;]/).map((s) => s.trim()).filter(Boolean));
      }
    }
    return phrases;
  }

  function extractKeywords(text, limit = 8) {
    const seen = new Set();
    const ordered = [];

    // 1) Prioritaskan kata kunci resmi dari penulis, kalau ada.
    for (const phrase of extractExplicitKeywordPhrases(text)) {
      for (const tok of tokenize(phrase)) {
        if (/^\d+$/.test(tok)) continue;
        if (!seen.has(tok)) {
          seen.add(tok);
          ordered.push(tok);
        }
      }
    }

    // 2) Lengkapi sisa slot dengan kata yang paling sering muncul di badan teks
    //    (kata pendek & angka tetap disaring supaya tidak jadi noise).
    const freq = new Map();
    for (const tok of tokenize(text)) {
      if (tok.length < 4) continue;
      if (/^\d+$/.test(tok)) continue;
      freq.set(tok, (freq.get(tok) || 0) + 1);
    }
    const byFreq = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
    for (const [tok] of byFreq) {
      if (ordered.length >= limit) break;
      if (!seen.has(tok)) {
        seen.add(tok);
        ordered.push(tok);
      }
    }

    return ordered.slice(0, limit);
  }

  function renderReport(report, keywords) {
    els.predictorReport.innerHTML = `
      <div class="report-level-wrap">
        <p class="report-level-caption">Estimasi Tingkat</p>
        <h2 class="report-level" style="color:${report.color}">${escapeHtml(report.level)}</h2>
        <span class="report-score" style="background:${report.color}">Skor ${report.score}</span>
      </div>
      <div>
        <div class="report-stats">
          <div class="report-stat">
            <p class="report-stat-label">Jumlah Kata</p>
            <p class="report-stat-value">${report.words.toLocaleString("id-ID")}</p>
          </div>
          <div class="report-stat">
            <p class="report-stat-label">Struktur IMRaD</p>
            <p class="report-stat-value">${report.sectionCount}/5 bagian</p>
          </div>
          <div class="report-stat">
            <p class="report-stat-label">Sitasi Unik</p>
            <p class="report-stat-value">${report.refsCount}</p>
          </div>
        </div>
        <p class="report-advice">${escapeHtml(report.advice)}</p>
        ${keywords.length ? `<p class="report-keywords">Topik terdeteksi: ${keywords.map((k) => `<span>${escapeHtml(k)}</span>`).join("")}</p>` : ""}
      </div>
    `;
  }

  function recommendJournals(keywords, acceptedLevels) {
    const query = keywords.join(" ");
    const tokens = keywords;
    const LEVEL_BONUS = 50; // penambah kecil untuk level yang cocok prediksi, bukan filter keras

    const scored = state.all.map((j) => {
      const topicScore = scoreJournal(j, tokens, query);
      const levelBonus = acceptedLevels.includes(j.sinta_level) ? LEVEL_BONUS : 0;
      return { j, topicScore, combined: topicScore + levelBonus };
    });

    // Prioritas utama: jurnal yang topiknya benar-benar cocok (topicScore > 0),
    // di ANTARA level manapun — supaya jurnal relevan tidak tersingkir hanya
    // karena levelnya beda dari prediksi. Level cocok cuma jadi pengurut kedua.
    const topical = scored
      .filter((x) => x.topicScore > 0)
      .sort((a, b) => b.combined - a.combined || levelRank(a.j.sinta_level) - levelRank(b.j.sinta_level));

    if (topical.length > 0) {
      return { list: topical.slice(0, 12).map((x) => x.j), fallbackUsed: false, hadKeywordMatch: true };
    }

    // Tidak ada satupun jurnal yang topiknya cocok (data mungkin belum lengkap):
    // fallback ke jurnal ber-level sesuai prediksi, diurutkan berdasar level saja.
    const levelOnly = state.all
      .filter((j) => acceptedLevels.includes(j.sinta_level))
      .sort((a, b) => levelRank(a.sinta_level) - levelRank(b.sinta_level));

    if (levelOnly.length > 0) {
      return { list: levelOnly.slice(0, 12), fallbackUsed: true, hadKeywordMatch: false };
    }

    return { list: [], fallbackUsed: true, hadKeywordMatch: false };
  }

  function handleAnalyzeDraft(e) {
    e.preventDefault();
    const text = els.draftInput.value;
    if (text.trim().length < 300) {
      alert("Naskah terlalu pendek untuk dianalisis. Tempelkan draf yang lebih lengkap (minimal beberapa paragraf).");
      return;
    }

    const report = analyzeDraftText(text);
    const keywords = extractKeywords(text);
    renderReport(report, keywords);
    els.predictorResultsWrap.hidden = false;

    const { list, fallbackUsed, hadKeywordMatch } = recommendJournals(keywords, report.acceptedLevels);

    const levelNote = report.acceptedLevels.join("/");
    if (!hadKeywordMatch && fallbackUsed) {
      els.predictorStatus.textContent = `Belum ada jurnal yang topiknya cocok dengan draf ini di katalog saat ini (kemungkinan data belum lengkap) — menampilkan jurnal ber-akreditasi ${levelNote} sebagai alternatif terdekat, diurutkan berdasarkan level saja (bukan topik).`;
    } else if (!hadKeywordMatch) {
      els.predictorStatus.textContent = `Tidak ditemukan jurnal yang cocok topik maupun levelnya di katalog saat ini. Coba jalankan pembaruan data (full-scrape) atau cek tab "Cari Jurnal" secara manual.`;
    } else {
      els.predictorStatus.textContent = `Rekomendasi jurnal tujuan, diurutkan berdasarkan kecocokan topik terdeteksi — jurnal ber-akreditasi ${levelNote} (sesuai estimasi) diprioritaskan bila topiknya sama-sama cocok:`;
    }

    els.predictorRecs.innerHTML = "";
    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Katalog jurnal masih kosong. Jalankan pembaruan data dulu di tab Cari Jurnal.";
      els.predictorRecs.appendChild(empty);
    } else {
      list.forEach((journal, i) => els.predictorRecs.appendChild(cardTemplate(journal, i)));
    }
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

    els.tabBtnSearch.addEventListener("click", () => switchTab("search"));
    els.tabBtnPredictor.addEventListener("click", () => switchTab("predictor"));
    els.predictorForm.addEventListener("submit", handleAnalyzeDraft);


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
