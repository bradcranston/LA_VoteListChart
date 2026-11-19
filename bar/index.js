// Vote list + stacked vote bars for the FileMaker Bill Monitor web viewer.
// Chart matches the betterforms billDetail page: a vote-type bar (Aye / Nay / Absent)
// over a party-split bar, where clicking a segment filters the list below it.
//
// FileMaker calls: loadData(json, flip)   (script "wv Load Bill Vote Data")
//   json = {"data":[{fieldData:{Cosponsor,NameFirst,NameLast,Party,Vote,Legislators_ID}}], "flip":bool}

const VOTES = ["Aye", "Nay", "Absent"];
const PARTIES = ["D", "R", "I"];

// Colors copied from the betterforms chart (Tailwind values).
const TOP_COLORS = {
  Aye: { bg: "#22c55e", fg: "#ffffff" },
  Nay: { bg: "#ef4444", fg: "#ffffff" },
  Absent: { bg: "#cbd5e1", fg: "#64748b" },
};
const PARTY_COLORS = {
  Aye: {
    D: { bg: "#2563eb", fg: "#ffffff" },
    R: { bg: "#dc2626", fg: "#ffffff" },
    I: { bg: "#6b7280", fg: "#ffffff" },
  },
  Nay: {
    D: { bg: "#93c5fd", fg: "#ffffff" },
    R: { bg: "#fca5a5", fg: "#ffffff" },
    I: { bg: "#d1d5db", fg: "#ffffff" },
  },
  Absent: {
    D: { bg: "#dbeafe", fg: "#2563eb", border: "#2563eb" },
    R: { bg: "#fee2e2", fg: "#dc2626", border: "#dc2626" },
    I: { bg: "#f3f4f6", fg: "#6b7280", border: "#6b7280" },
  },
};
const PARTY_NAMES = { D: "Democrat", R: "Republican", I: "Independent" };
const PARTY_SHORT = { D: "Dem", R: "Rep", I: "Ind" };

// "Abs" (betterforms) and "Absent" (Data API) both mean absent; anything that
// isn't Aye/Nay (NV, Excused, ...) is counted with Absent so the bar fills 100%.
function voteKey(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "aye" || s === "yea" || s === "yes") return "Aye";
  if (s === "nay" || s === "no") return "Nay";
  return "Absent";
}
function partyKey(p) {
  const s = String(p || "").trim().toUpperCase();
  return s === "D" || s === "R" ? s : "I";
}
function parseBool(v) {
  if (typeof v === "boolean") return v;
  if (v === undefined || v === null || v === "") return false;
  try {
    return Boolean(JSON.parse(v));
  } catch (e) {
    return String(v).toLowerCase() === "true";
  }
}

let table = null;

window.loadData = (json, f) => {
  const data = typeof json === "string" ? JSON.parse(json) : json;
  const flip = f === undefined ? parseBool(data.flip) : parseBool(f);

  const rows = (data.data || [])
    .map((e) => Object.assign({}, e.fieldData || e))
    .filter((row) => row.NameLast !== "Vacant");

  rows.forEach((row, index) => {
    row.index = index;
    row.VoteKey = voteKey(row.Vote);
    row.PartyKey = partyKey(row.Party);
    row.FullName = `${(row.NameFirst || "").trim()} ${(row.NameLast || "").trim()}`;
  });

  // ---------- state ----------
  const state = { vote: null, party: null, search: "" };

  // Top-bar colors honour the bill's "flip" flag, same as the row colors.
  const topColors = {
    Aye: flip ? TOP_COLORS.Nay : TOP_COLORS.Aye,
    Nay: flip ? TOP_COLORS.Aye : TOP_COLORS.Nay,
    Absent: TOP_COLORS.Absent,
  };

  // ---------- table ----------
  if (table) {
    table.destroy();
    $("#table").empty();
  }

  // Filtering by chart segment + name search (name only, like betterforms).
  $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter((fn) => !fn._voteChart);
  const rowFilter = function (settings, searchData, dataIndex, rowData) {
    if (settings.nTable.id !== "table") return true;
    if (state.vote && rowData.VoteKey !== state.vote) return false;
    if (state.party && rowData.PartyKey !== state.party) return false;
    if (state.search && !rowData.FullName.toLowerCase().includes(state.search)) return false;
    return true;
  };
  rowFilter._voteChart = true;
  $.fn.dataTable.ext.search.push(rowFilter);

  table = $("#table").DataTable({
    data: rows,
    dom: "lrt",
    paging: false,
    scrollResize: true,
    scrollCollapse: true,
    scrollY: "30000px",
    fixedHeader: false,
    ordering: true,
    order: [
      [2, "asc"],
      [1, "asc"],
    ],
    info: false,
    columns: [
      { data: "Cosponsor", name: "cosponsor", visible: false },
      { data: "NameFirst", name: "NameFirst", visible: false },
      { data: "NameLast", name: "NameLast", visible: false },
      { data: "Party", name: "party", visible: false },
      { data: "Vote", name: "Vote", visible: false },
      {
        // Party icon
        render: function (data, type, row) {
          const $party = document.createElement("div");
          $party.classList.add(row.Party === "R" ? "i-circle-red" : "i-circle-blue");
          $party.textContent = row.Party;
          return $party;
        },
        orderable: false,
      },
      {
        // Name -> navigate to legislator in FileMaker
        render: function (data, type, row) {
          const name = document.createElement("div");
          name.onclick = function (event) {
            callFM({ Legislators_ID: row.Legislators_ID, action: "navigate" });
            if (event) event.stopPropagation();
          };
          name.classList.add("bold");
          name.textContent = row.NameFirst + " " + row.NameLast;
          return name;
        },
        orderable: false,
      },
      {
        // Cosponsor
        render: function (data, type, row) {
          const cosp = document.createElement("div");
          cosp.classList.add("cosp");
          if (row.Cosponsor) cosp.textContent = "Cosponsor";
          return cosp;
        },
        orderable: false,
      },
      {
        // Vote
        render: function (data, type, row) {
          const vote = document.createElement("div");
          vote.textContent = row.Vote;
          vote.classList.add("vote");
          if (row.VoteKey === "Aye") vote.classList.add(flip ? "voteRed" : "voteGreen");
          else if (row.VoteKey === "Nay") vote.classList.add(flip ? "voteGreen" : "voteRed");
          else vote.classList.add("voteYellow");
          return vote;
        },
        orderable: false,
      },
    ],
  });

  // ---------- counts ----------
  const total = rows.length;
  const count = (vote, party) =>
    rows.filter((r) => (!vote || r.VoteKey === vote) && (!party || r.PartyKey === party)).length;
  const pct = (n, of) => (of ? (n / of) * 100 : 0);
  const hasInd = rows.some((r) => r.PartyKey === "I");

  // ---------- chart ----------
  const $chart = document.getElementById("vc-chart");
  $chart.innerHTML = "";
  const segments = []; // {el, vote, party}

  function makeSwatch(color, label) {
    const item = document.createElement("span");
    item.className = "vc-legend-item";
    const sw = document.createElement("span");
    sw.className = "vc-swatch";
    sw.style.backgroundColor = color.bg;
    if (color.border) sw.style.border = `1px solid ${color.border}`;
    item.appendChild(sw);
    item.appendChild(document.createTextNode(label));
    return item;
  }

  function makeSegment(vote, party, n, widthPct, color, cls) {
    const seg = document.createElement("div");
    seg.className = `vc-seg ${cls}`;
    seg.style.backgroundColor = color.bg;
    seg.style.color = color.fg;
    seg.style.width = "0%";
    seg.dataset.width = widthPct;
    seg.title = party ? `${PARTY_NAMES[party]} ${vote}: ${n}` : `${vote}: ${n}`;
    seg.setAttribute("role", "button");
    seg.tabIndex = 0;
    const label = document.createElement("span");
    label.textContent = n;
    seg.appendChild(label);
    const onPick = () => toggleFilter(vote, party);
    seg.addEventListener("click", onPick);
    seg.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPick();
      }
    });
    segments.push({ el: seg, vote, party });
    return seg;
  }

  // Legend: Aye / Nay / Absent
  const topLegend = document.createElement("div");
  topLegend.className = "vc-legend";
  VOTES.forEach((v) => topLegend.appendChild(makeSwatch(topColors[v], v)));
  $chart.appendChild(topLegend);

  // Top bar: vote type
  const topBar = document.createElement("div");
  topBar.className = "vc-bar vc-bar-top";
  VOTES.forEach((v) => {
    const n = count(v);
    if (n) topBar.appendChild(makeSegment(v, null, n, pct(n, total), topColors[v], "vc-seg-top"));
  });
  $chart.appendChild(topBar);

  // Party bar: each vote group split by party, aligned under the top segment
  const partyBar = document.createElement("div");
  partyBar.className = "vc-bar vc-bar-party";
  VOTES.forEach((v) => {
    const n = count(v);
    if (!n) return;
    const group = document.createElement("div");
    group.className = "vc-group";
    group.style.width = "0%";
    group.dataset.width = pct(n, total);
    PARTIES.forEach((p) => {
      const pn = count(v, p);
      if (pn) group.appendChild(makeSegment(v, p, pn, pct(pn, n), PARTY_COLORS[v][p], "vc-seg-party"));
    });
    partyBar.appendChild(group);
  });
  $chart.appendChild(partyBar);

  // Legend: party split
  const partyLegend = document.createElement("div");
  partyLegend.className = "vc-legend vc-legend-party";
  VOTES.forEach((v) => {
    const grp = document.createElement("span");
    grp.className = "vc-legend-group";
    const parties = hasInd ? PARTIES : ["D", "R"];
    parties.forEach((p) =>
      grp.appendChild(makeSwatch(PARTY_COLORS[v][p], `${PARTY_SHORT[p]} ${v}`))
    );
    partyLegend.appendChild(grp);
  });
  $chart.appendChild(partyLegend);

  // Grow the bars in (mirrors the 300ms width transition in betterforms)
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      $chart.querySelectorAll("[data-width]").forEach((el) => {
        el.style.width = `${el.dataset.width}%`;
      });
    })
  );

  // ---------- toolbar ----------
  const $search = document.getElementById("vc-search");
  const $count = document.getElementById("vc-count");
  const $filter = document.getElementById("vc-filter");
  const $filterText = document.getElementById("vc-filter-text");
  const $reset = document.getElementById("vc-reset");

  $search.value = "";
  $search.oninput = () => {
    state.search = $search.value.trim().toLowerCase();
    table.draw();
  };
  $reset.onclick = () => setFilter(null, null);

  function refreshUI() {
    // dim the active segment, like betterforms (opacity .6)
    segments.forEach((s) => {
      const active = s.vote === state.vote && s.party === state.party;
      s.el.classList.toggle("is-active", active);
      s.el.setAttribute("aria-pressed", active ? "true" : "false");
    });

    // count badge
    $count.textContent = total
      ? `${table.rows({ search: "applied" }).count()} VOTES`
      : "No votes currently available";

    // filter label + reset
    const on = state.vote || state.party;
    $filter.hidden = !on;
    $filterText.innerHTML = "";
    if (state.vote) {
      const s = document.createElement("span");
      s.className = `vc-f-vote vc-f-${state.vote.toLowerCase()}`;
      s.textContent = state.vote;
      $filterText.appendChild(s);
    }
    if (state.vote && state.party) $filterText.appendChild(document.createTextNode(" • "));
    if (state.party) {
      const s = document.createElement("span");
      s.className = `vc-f-party vc-f-${state.party.toLowerCase()}`;
      s.textContent = PARTY_NAMES[state.party];
      $filterText.appendChild(s);
    }
  }

  function setFilter(vote, party) {
    state.vote = vote || null;
    state.party = party || null;
    table.draw();
  }

  // Clicking the same segment again clears it; clicking a segment clears the name search.
  function toggleFilter(vote, party) {
    state.search = "";
    $search.value = "";
    if (state.vote === vote && state.party === (party || null)) setFilter(null, null);
    else setFilter(vote, party);
  }

  table.on("draw", refreshUI);
  refreshUI();

  // ---------- functions FileMaker (or older layouts) can call ----------
  window.filterVote = (value) => toggleFilter(voteKey(value), null);
  window.filterParty = (value) => {
    const p = partyKey(value);
    if (!state.vote && state.party === p) setFilter(null, null);
    else setFilter(null, p);
  };
  window.filterVoteClear = () => setFilter(null, state.party);
  window.filterPartyClear = () => setFilter(state.vote, null);
  window.filterAll = () => {
    state.search = "";
    $search.value = "";
    setFilter(null, null);
  };
  window.sortNames = function () {
    table
      .order([
        { name: "NameLast", dir: "asc" },
        { name: "NameFirst", dir: "asc" },
      ])
      .draw();
  };
  window.refreshRow = function (col) {
    table.column(col).cells().invalidate();
    table.column(col).render();
  };
};

window.callFM = function (result) {
  FileMaker.PerformScript("wv_runScript", JSON.stringify(result));
};

window.exportFM = function () {
  if (!table) return;
  let dataExport = table.buttons.exportData();
  let data = dataExport.body.map((subArr) => subArr[11]);
  FileMaker.PerformScriptWithOption("wv_Export", JSON.stringify(data), "0");
};
