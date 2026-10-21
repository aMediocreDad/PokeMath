(function () {
  const teacherSession = localStorage.getItem("teacherSession");
  const mustLogin   = document.getElementById("mustLogin");
  const settingsBox = document.getElementById("settingsBox");
  const startBtn    = document.getElementById("startBtn");
  const resetBtn    = document.getElementById("resetBtn");
  const statusEl    = document.getElementById("status");
  const diffEl      = document.getElementById("difficulty");
  const minLevelEl  = document.getElementById("minLevel");
  const allowAdaptiveRow = document.getElementById("allowAdaptiveRow");
  const allowAdaptiveEl  = document.getElementById("allowAdaptive");
  const classEl     = document.getElementById("className");
  const prizeEl       = document.getElementById("prizeType");
  const prizeSecretEl = document.getElementById("prizeSecret");
  const gridSizeEl    = document.getElementById("gridSize");

  function updateAdaptiveRow() {
    if (!minLevelEl || !allowAdaptiveRow) return;
    const v = minLevelEl.value;
    const showCheckbox = v !== "alle" && v !== "tilpasset";
    allowAdaptiveRow.style.display = showCheckbox ? "flex" : "none";
    if (!showCheckbox && allowAdaptiveEl) allowAdaptiveEl.checked = false;
  }

  function setStatus(msg, kind) {
    statusEl.className = "status" + (kind ? " " + kind : "");
    statusEl.textContent = msg || "";
  }

  if (!teacherSession) {
    if (mustLogin)   mustLogin.style.display   = "block";
    if (settingsBox) settingsBox.style.display = "none";
    return;
  }

  if (mustLogin)   mustLogin.style.display   = "none";
  if (settingsBox) settingsBox.style.display = "block";

  // Restore previous settings
  try {
    const prev = JSON.parse(sessionStorage.getItem("bingoSettings") || "{}");
    if (prev.difficulty && diffEl) diffEl.value = prev.difficulty;
    if (prev.minLevel  && minLevelEl) minLevelEl.value = prev.minLevel;
    if (prev.allowAdaptive !== undefined && allowAdaptiveEl) allowAdaptiveEl.checked = !!prev.allowAdaptive;
    if (prev.className  && classEl) classEl.value = prev.className;
    if (prev.prizeType  && prizeEl) prizeEl.value = prev.prizeType;
    if (prev.prizeSecret !== undefined && prizeSecretEl) prizeSecretEl.checked = !!prev.prizeSecret;
    if (prev.gridSize    && gridSizeEl)  gridSizeEl.value = String(prev.gridSize);
  } catch (_) {}

  if (minLevelEl) {
    updateAdaptiveRow();
    minLevelEl.addEventListener("change", updateAdaptiveRow);
  }

  startBtn.addEventListener("click", () => {
    const difficulty     = diffEl ? diffEl.value : "medium";
    const minLevel       = minLevelEl ? minLevelEl.value : "alle";
    const allowAdaptive  = allowAdaptiveEl ? allowAdaptiveEl.checked : false;
    const className      = classEl ? classEl.value.trim() : "";
    const prizeType      = prizeEl ? prizeEl.value : "random";
    const prizeSecret    = prizeSecretEl ? prizeSecretEl.checked : false;
    const gridSize       = gridSizeEl ? parseInt(gridSizeEl.value) || 5 : 5;

    sessionStorage.setItem("bingoSettings", JSON.stringify({ difficulty, minLevel, allowAdaptive, className, prizeType, prizeSecret, gridSize }));
    sessionStorage.setItem("bingoForceNew", "1");
    setStatus("Starter bingo…");
    startBtn.disabled = true;

    location.href = "/lærer/bingo_host.html";
  });

  resetBtn.addEventListener("click", () => {
    if (diffEl)          diffEl.value          = "medium";
    if (minLevelEl)      minLevelEl.value      = "alle";
    if (allowAdaptiveEl) allowAdaptiveEl.checked = false;
    updateAdaptiveRow();
    if (classEl)    classEl.value    = "";
    if (prizeEl)       prizeEl.value    = "random";
    if (prizeSecretEl) prizeSecretEl.checked = false;
    if (gridSizeEl)    gridSizeEl.value = "5";
    sessionStorage.removeItem("bingoSettings");
    setStatus("");
  });
})();
