/* ── Palette ─────────────────────────────────────────────────── */
const COLORS = [
  "#6ee7b7","#f59e0b","#818cf8","#f87171",
  "#34d399","#fbbf24","#a78bfa","#fb923c",
  "#60a5fa","#e879f9"
];

const EMOJI_MAP = {
  "💎 High Income, High Spender": "💎",
  "💰 High Income, Low Spender":  "💰",
  "🛍️ Low Income, High Spender": "🛍️",
  "🪙 Low Income, Low Spender":   "🪙",
  "📊 Average Customer":          "📊",
};

const DESC_MAP = {
  "💎 High Income, High Spender": "Pelanggan premium dengan daya beli tinggi. Segmen paling menguntungkan bagi bisnis.",
  "💰 High Income, Low Spender":  "Pendapatan tinggi namun berbelanja sedikit. Potensi besar dengan pendekatan yang tepat.",
  "🛍️ Low Income, High Spender": "Pendapatan rendah tapi sering belanja. Loyalitas tinggi — cocok untuk program diskon.",
  "🪙 Low Income, Low Spender":   "Pendapatan & belanja rendah. Butuh promosi harga dan penawaran menarik.",
  "📊 Average Customer":          "Profil rata-rata. Basis pelanggan umum yang stabil dan konsisten.",
};

/* ── State ───────────────────────────────────────────────────── */
let scatterChart = null;
let elbowChart   = null;
let allRows      = [];
let currentPage  = 1;
const PAGE_SIZE  = 15;

/* ── Run ─────────────────────────────────────────────────────── */
async function runAnalysis() {
  const k = parseInt(document.getElementById("kInput").value) || 5;
  if (k < 2 || k > 10) { alert("Masukkan nilai K antara 2 sampai 10."); return; }

  document.getElementById("results").classList.add("hidden");
  document.getElementById("loading").classList.remove("hidden");

  try {
    const res  = await fetch("/api/run", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ k }),
    });
    const data = await res.json();

    document.getElementById("loading").classList.add("hidden");
    document.getElementById("results").classList.remove("hidden");

    fillMetrics(data);
    buildScatter(data);
    buildElbow(data);
    buildClusterCards(data);
    buildTable(data);

    document.getElementById("results").scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    document.getElementById("loading").classList.add("hidden");
    alert("Terjadi error: " + e.message);
  }
}

/* Enter key support */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("kInput").addEventListener("keydown", e => {
    if (e.key === "Enter") runAnalysis();
  });
});

/* ── Metrics ─────────────────────────────────────────────────── */
function fillMetrics(data) {
  document.getElementById("mTotal").textContent  = data.total;
  document.getElementById("mK").textContent      = data.k;
  document.getElementById("mIncome").textContent = "$" + data.avg_income + "k";
  document.getElementById("mScore").textContent  = data.avg_score;
  document.getElementById("scatterBadge").textContent = "K = " + data.k;
}

/* ── Scatter Chart ───────────────────────────────────────────── */
function buildScatter(data) {
  if (scatterChart) scatterChart.destroy();

  const datasets = [];
  const k = data.k;

  for (let c = 0; c < k; c++) {
    const cd = data.scatter[c];
    if (!cd) continue;
    datasets.push({
      label: "Cluster " + c,
      data: cd.x.map((xi, i) => ({ x: xi, y: cd.y[i] })),
      backgroundColor: COLORS[c] + "cc",
      pointRadius: 6,
      pointHoverRadius: 9,
    });
  }

  const ctx = document.getElementById("scatterChart").getContext("2d");
  scatterChart = new Chart(ctx, {
    type: "scatter",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#181c24",
          borderColor: "rgba(255,255,255,.1)",
          borderWidth: 1,
          titleColor: "#e8eaf0",
          bodyColor: "#8a90a0",
          callbacks: {
            label: item => ` Income: $${item.raw.x}k | Score: ${item.raw.y}`,
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: "Annual Income (k$)", color: "#8a90a0" },
          grid: { color: "rgba(255,255,255,.05)" },
          ticks: { color: "#8a90a0" },
          min: 10, max: 145,
        },
        y: {
          title: { display: true, text: "Spending Score (1–100)", color: "#8a90a0" },
          grid: { color: "rgba(255,255,255,.05)" },
          ticks: { color: "#8a90a0" },
          min: 0, max: 105,
        }
      }
    }
  });

  // Legend
  const leg = document.getElementById("scatterLegend");
  leg.innerHTML = "";
  for (let c = 0; c < k; c++) {
    const lbl = data.label_map[c] || "Cluster " + c;
    leg.innerHTML += `
      <span class="legend-item">
        <span class="legend-dot" style="background:${COLORS[c]}"></span>
        <span>C${c}: ${lbl}</span>
      </span>`;
  }
}

/* ── Elbow Chart ─────────────────────────────────────────────── */
function buildElbow(data) {
  if (elbowChart) elbowChart.destroy();

  const optK = data.k;
  const pointColors = data.elbow.k_values.map(k =>
    k === optK ? "#f59e0b" : "#6ee7b7"
  );
  const pointSizes = data.elbow.k_values.map(k => k === optK ? 9 : 5);

  const ctx = document.getElementById("elbowChart").getContext("2d");
  elbowChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.elbow.k_values,
      datasets: [{
        label: "Inertia",
        data: data.elbow.inertia,
        borderColor: "#6ee7b7",
        backgroundColor: "rgba(110,231,183,.08)",
        pointBackgroundColor: pointColors,
        pointRadius: pointSizes,
        fill: true,
        tension: 0.35,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#181c24",
          borderColor: "rgba(255,255,255,.1)",
          borderWidth: 1,
          titleColor: "#e8eaf0",
          bodyColor: "#8a90a0",
          callbacks: {
            title: items => "K = " + items[0].label,
            label: item => " Inertia: " + item.raw.toFixed(1),
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: "Jumlah Cluster (K)", color: "#8a90a0" },
          grid: { color: "rgba(255,255,255,.05)" },
          ticks: { color: "#8a90a0" },
        },
        y: {
          title: { display: true, text: "Inertia (WCSS)", color: "#8a90a0" },
          grid: { color: "rgba(255,255,255,.05)" },
          ticks: { color: "#8a90a0" },
        }
      }
    }
  });
}

/* ── Cluster Cards ───────────────────────────────────────────── */
function buildClusterCards(data) {
  const grid = document.getElementById("clusterCards");
  grid.innerHTML = "";

  data.stats.forEach((s, i) => {
    const color = COLORS[s.cluster];
    const desc  = DESC_MAP[s.label] || "Kelompok pelanggan berdasarkan pola belanja.";
    const emoji = EMOJI_MAP[s.label] || "📊";
    grid.innerHTML += `
      <div class="cluster-card" style="border-top-color:${color}; animation-delay:${i*0.07}s">
        <span class="cc-emoji">${emoji}</span>
        <div class="cc-label">${s.label.replace(/^[^\s]+\s/, '')}</div>
        <div class="cc-count">${s.count} pelanggan</div>
        <div class="cc-stats">
          <div class="cc-stat">
            <span class="sv" style="color:${color}">$${s.avg_income}k</span>
            <span class="sk">Avg Income</span>
          </div>
          <div class="cc-stat">
            <span class="sv" style="color:${color}">${s.avg_score}</span>
            <span class="sk">Avg Score</span>
          </div>
        </div>
        <p style="font-size:11px; color:#8a90a0; margin-top:10px; line-height:1.5">${desc}</p>
      </div>`;
  });
}

/* ── Table ───────────────────────────────────────────────────── */
function buildTable(data) {
  allRows = data.table;
  currentPage = 1;

  const sel = document.getElementById("filterCluster");
  sel.innerHTML = `<option value="-1">Semua Cluster</option>`;
  for (let c = 0; c < data.k; c++) {
    sel.innerHTML += `<option value="${c}">Cluster ${c} — ${(data.label_map[c]||'').replace(/^[^\s]+\s/,'')}</option>`;
  }

  renderTable();
}

function renderTable() {
  currentPage = 1;
  renderPage();
}

function renderPage() {
  const filter = parseInt(document.getElementById("filterCluster").value);
  const rows   = filter === -1 ? allRows : allRows.filter(r => r.cluster === filter);
  const pages  = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const slice  = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  document.getElementById("tableCount").textContent = `${rows.length} data`;
  document.getElementById("pgInfo").textContent = `${currentPage} / ${pages}`;

  const tbody = document.getElementById("dataTbody");
  tbody.innerHTML = "";

  slice.forEach(r => {
    const color = COLORS[r.cluster];
    tbody.innerHTML += `
      <tr>
        <td>${r.id}</td>
        <td>${r.gender}</td>
        <td>${r.age}</td>
        <td>$${r.income}k</td>
        <td>${r.score}</td>
        <td><span class="cl-badge" style="background:${color}22; color:${color}; border:1px solid ${color}44">${r.cluster}</span></td>
        <td class="seg-label">${r.label}</td>
      </tr>`;
  });
}

function changePage(dir) {
  const filter = parseInt(document.getElementById("filterCluster").value);
  const rows   = filter === -1 ? allRows : allRows.filter(r => r.cluster === filter);
  const pages  = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  currentPage  = Math.max(1, Math.min(currentPage + dir, pages));
  renderPage();
}
