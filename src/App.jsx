import { useState, useEffect, useRef, useCallback } from "react";

// ── 치평 색채 연구소 v2 ─────────────────────────────────────
// Adobe Express 스타일: 색상환 드래그 + 색상 조화 규칙 + 큰 컬럼 미리보기
// + 헥스 복사 / Export JSON / 반 갤러리 공유 / 리히터의 벽

const INK = "#1A1A1A";
const GRAY = "#8B8B85";
const LINE = "#E6E5E0";

// ---------- 색 변환 유틸 ----------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function hsvToHex(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to2 = (n) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return ("#" + to2(r) + to2(g) + to2(b)).toUpperCase();
}

function hexToHsv(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: (h + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
}

const textColorOn = (hex) => {
  const hsv = hexToHsv(hex);
  return hsv && hsv.v > 0.62 && !(hsv.s > 0.75 && hsv.v < 0.8) ? "#1A1A1A" : "#FFFFFF";
};

// ---------- 색상 조화 규칙 (기준색 = 3번째 핸들) ----------
const HARMONIES = {
  custom: { label: "사용자 정의", offsets: null },
  analogous: { label: "유사", offsets: [{ dh: -30 }, { dh: -15 }, { dh: 0 }, { dh: 15 }, { dh: 30 }] },
  mono: { label: "단색", offsets: [{ dh: 0, ds: -0.55 }, { dh: 0, ds: -0.3 }, { dh: 0 }, { dh: 0, dv: -0.25 }, { dh: 0, dv: -0.5 }] },
  complementary: { label: "보색", offsets: [{ dh: 0, ds: -0.35 }, { dh: 0 }, { dh: 0, dv: -0.3 }, { dh: 180, ds: -0.3 }, { dh: 180 }] },
  split: { label: "분할 보색", offsets: [{ dh: -150, ds: -0.3 }, { dh: -150 }, { dh: 0 }, { dh: 150 }, { dh: 150, ds: -0.3 }] },
  triad: { label: "삼각형", offsets: [{ dh: -120 }, { dh: -120, ds: -0.35 }, { dh: 0 }, { dh: 120, ds: -0.35 }, { dh: 120 }] },
  square: { label: "정사각형", offsets: [{ dh: -90 }, { dh: 0, ds: -0.35 }, { dh: 0 }, { dh: 90 }, { dh: 180 }] },
};
const BASE_IDX = 2;

function applyHarmony(mode, base) {
  const off = HARMONIES[mode].offsets;
  if (!off) return null;
  return off.map((o) => ({
    h: (base.h + (o.dh || 0) + 360) % 360,
    s: clamp(base.s + (o.ds || 0), 0.05, 1),
    v: clamp(base.v + (o.dv || 0), 0.15, 1),
  }));
}

const shuffleArr = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ============================================================
export default function App() {
  const [tab, setTab] = useState("make");
  const [mode, setMode] = useState("custom");
  const [hsvs, setHsvs] = useState(() =>
    // 시작 팔레트: 「여름 쨍쨍」 (Adobe Color 예시와 동일)
    ["#F24B78", "#038C7E", "#00A583", "#80C0BF", "#F8CEB8"].map((h) => hexToHsv(h))
  );
  const [activeIdx, setActiveIdx] = useState(BASE_IDX);
  const [paletteName, setPaletteName] = useState("");
  const [name, setName] = useState("");
  const [klass, setKlass] = useState("");
  const [toast, setToast] = useState("");
  const [palettes, setPalettes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [wallSeed, setWallSeed] = useState(0);

  const wheelRef = useRef(null);
  const dragIdx = useRef(-1);

  const hexes = hsvs.map((c) => hsvToHex(c.h, c.s, c.v));

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  // ---------- 색상환 드래그 ----------
  const posFromHsv = (c, R) => ({
    x: R + R * c.s * Math.sin((c.h * Math.PI) / 180),
    y: R - R * c.s * Math.cos((c.h * Math.PI) / 180),
  });

  const hsvFromPointer = (clientX, clientY) => {
    const rect = wheelRef.current.getBoundingClientRect();
    const R = rect.width / 2;
    const dx = clientX - rect.left - R;
    const dy = clientY - rect.top - R;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), R);
    const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    return { h, s: dist / R };
  };

  const updateFromDrag = useCallback((clientX, clientY) => {
    const i = dragIdx.current;
    if (i < 0) return;
    const { h, s } = hsvFromPointer(clientX, clientY);
    setHsvs((prev) => {
      const v = prev[i].v;
      if (mode === "custom") {
        return prev.map((c, k) => (k === i ? { h, s, v } : c));
      }
      const off = HARMONIES[mode].offsets[i];
      const base = {
        h: (h - (off.dh || 0) + 360) % 360,
        s: clamp(s - (off.ds || 0), 0.05, 1),
        v: clamp(v - (off.dv || 0), 0.15, 1),
      };
      return applyHarmony(mode, base);
    });
  }, [mode]);

  useEffect(() => {
    const move = (e) => {
      if (dragIdx.current < 0) return;
      e.preventDefault();
      const p = e.touches ? e.touches[0] : e;
      updateFromDrag(p.clientX, p.clientY);
    };
    const up = () => { dragIdx.current = -1; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [updateFromDrag]);

  const changeMode = (m) => {
    setMode(m);
    if (m !== "custom") setHsvs((prev) => applyHarmony(m, prev[BASE_IDX]));
  };

  const randomize = () => {
    const base = { h: Math.random() * 360, s: 0.5 + Math.random() * 0.5, v: 0.55 + Math.random() * 0.45 };
    if (mode === "custom") {
      setHsvs(Array.from({ length: 5 }, () => ({
        h: Math.random() * 360, s: 0.4 + Math.random() * 0.6, v: 0.5 + Math.random() * 0.5,
      })));
    } else setHsvs(applyHarmony(mode, base));
  };

  const setHexAt = (i, raw) => {
    const hsv = hexToHsv(raw);
    if (!hsv) return;
    setHsvs((prev) => {
      if (mode === "custom") return prev.map((c, k) => (k === i ? hsv : c));
      const off = HARMONIES[mode].offsets[i];
      const base = {
        h: (hsv.h - (off.dh || 0) + 360) % 360,
        s: clamp(hsv.s - (off.ds || 0), 0.05, 1),
        v: clamp(hsv.v - (off.dv || 0), 0.15, 1),
      };
      return applyHarmony(mode, base);
    });
  };

  // ---------- 복사 / Export JSON ----------
  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement("textarea");
      t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } catch (e) { /* ignore */ }
      t.remove();
    }
    showToast(`${label || text} 복사됨`);
  };

  const exportJSON = () => {
    const data = {
      name: paletteName.trim() || "나의 팔레트",
      author: name.trim() || undefined,
      class: klass.trim() || undefined,
      harmony: HARMONIES[mode].label,
      colors: hexes,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(paletteName.trim() || "palette").replace(/\s+/g, "_")}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("JSON 파일로 저장했어요");
  };

  // ---------- 공유 저장소 ----------
  const loadPalettes = useCallback(async () => {
    setLoading(true);
    try {
      const listed = await window.storage.list("palette:", true);
      const keys = listed?.keys || [];
      const results = [];
      for (const k of keys) {
        try {
          const r = await window.storage.get(k.key || k, true);
          if (r?.value) results.push({ key: k.key || k, ...JSON.parse(r.value) });
        } catch (e) { /* skip */ }
      }
      results.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setPalettes(results);
    } catch (e) { setPalettes([]); }
    setLoading(false);
  }, []);

  useEffect(() => { loadPalettes(); }, [loadPalettes]);

  const submit = async () => {
    if (!name.trim()) { showToast("이름(또는 닉네임)을 적어 주세요"); return; }
    if (!paletteName.trim()) { showToast("팔레트 이름을 지어 주세요"); return; }
    setSubmitting(true);
    try {
      const entry = {
        name: name.trim(), klass: klass.trim(), title: paletteName.trim(),
        harmony: HARMONIES[mode].label, colors: hexes, ts: Date.now(),
      };
      const key = `palette:${entry.ts}_${Math.random().toString(36).slice(2, 7)}`;
      const ok = await window.storage.set(key, JSON.stringify(entry), true);
      if (!ok) throw new Error("save failed");
      showToast("갤러리에 전시되었어요 🎨");
      await loadPalettes();
      setTab("gallery");
    } catch (e) { showToast("저장에 실패했어요. 다시 시도해 주세요"); }
    setSubmitting(false);
  };

  const allChips = palettes.flatMap((p) => p.colors || []);
  const wallChips = shuffleArr(allChips);
  void wallSeed;

  // ---------- 렌더 ----------
  const R = 150; // 색상환 반지름(px)

  const tabBtn = (id, label) => (
    <button key={id} onClick={() => setTab(id)} className="tabBtn"
      style={{
        color: tab === id ? INK : GRAY,
        borderBottom: tab === id ? `2px solid ${INK}` : "2px solid transparent",
        fontWeight: tab === id ? 700 : 400,
      }}>{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", color: INK, fontFamily: "'Noto Sans KR','Apple SD Gothic Neo',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet" />
      <style>{`
        .tabBtn { background:none; border:none; cursor:pointer; padding:10px 4px; margin-right:22px; font-size:15px; font-family:inherit; letter-spacing:0.02em; }
        .layout { display:grid; grid-template-columns: 360px 1fr; gap:36px; }
        .cols { display:flex; height: 520px; border-radius: 10px; overflow:hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.12); }
        .harmonyBtn { border:1px solid ${LINE}; background:#fff; border-radius:8px; padding:8px 12px; font-size:13px; cursor:pointer; font-family:inherit; }
        .col:hover .copyIc { opacity: 1; }
        input.field { padding:11px 13px; border:1px solid ${LINE}; border-radius:8px; font-size:14px; font-family:inherit; background:#fff; }
        @media (max-width: 860px) {
          .layout { grid-template-columns: 1fr; }
          .cols { height: 300px; }
        }
      `}</style>

      <header style={{ maxWidth: 1080, margin: "0 auto", padding: "36px 20px 0" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.22em", color: GRAY, marginBottom: 8 }}>
          치평중학교 미술 수업 · 색채 프로젝트
        </div>
        <h1 style={{ fontSize: "clamp(26px,4.5vw,36px)", fontWeight: 900, margin: 0, lineHeight: 1.3 }}>
          색상 팔레트 생성기 및 색상환 도구
        </h1>
        <p style={{ color: GRAY, fontSize: 14, marginTop: 8, lineHeight: 1.7, maxWidth: 620 }}>
          색상환의 점을 드래그해 나만의 다섯 가지 색을 만들어 보세요. 색상 조화 규칙을 적용하면
          균형 잡힌 팔레트가 자동으로 생성됩니다. 완성한 팔레트는 갤러리에 전시되어 반 친구 모두가 볼 수 있어요.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: GRAY, letterSpacing: "0.06em" }}>참고 도구</span>
          <a href="https://colorion.co/" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 13, color: INK, textDecoration: "none", border: `1px solid ${LINE}`, borderRadius: 999, padding: "6px 14px", background: "#fff" }}>
            🎨 Colorion — 팔레트 구경하기 ↗
          </a>
          <a href="https://color.adobe.com/kr/create/color-wheel"
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 13, color: INK, textDecoration: "none", border: `1px solid ${LINE}`, borderRadius: 999, padding: "6px 14px", background: "#fff" }}>
            🌈 Adobe Color — 색상환 도구 ↗
          </a>
        </div>
        <nav style={{ borderBottom: `1px solid ${LINE}`, marginTop: 20 }}>
          {tabBtn("make", "① 팔레트 만들기")}
          {tabBtn("gallery", `② 우리 반 갤러리${palettes.length ? ` (${palettes.length})` : ""}`)}
          {tabBtn("wall", "③ 리히터의 벽")}
        </nav>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 80px" }}>

        {/* ══════════ ① 팔레트 만들기 ══════════ */}
        {tab === "make" && (
          <section className="layout">
            {/* ── 왼쪽: 색상환 패널 ── */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <b style={{ fontSize: 15 }}>🎨 색상환</b>
                <button onClick={randomize} className="harmonyBtn" style={{ fontWeight: 700 }}>⤨ 무작위 생성</button>
              </div>

              {/* 색상환 */}
              <div
                ref={wheelRef}
                style={{
                  position: "relative", width: R * 2, height: R * 2, maxWidth: "100%",
                  borderRadius: "50%", margin: "0 auto", touchAction: "none",
                  background: `radial-gradient(circle closest-side, #ffffff 0%, rgba(255,255,255,0) 78%),
                    conic-gradient(from 0deg, #FF0000, #FFFF00 60deg, #00FF00 120deg, #00FFFF 180deg, #0000FF 240deg, #FF00FF 300deg, #FF0000 360deg)`,
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
                }}
                onPointerDown={(e) => {
                  // 빈 곳 클릭 → 활성 핸들 이동
                  dragIdx.current = activeIdx;
                  updateFromDrag(e.clientX, e.clientY);
                }}
              >
                {hsvs.map((c, i) => {
                  const p = posFromHsv(c, R);
                  const isActive = i === activeIdx;
                  const isBase = i === BASE_IDX && mode !== "custom";
                  return (
                    <div
                      key={i}
                      onPointerDown={(e) => { e.stopPropagation(); dragIdx.current = i; setActiveIdx(i); }}
                      style={{
                        position: "absolute",
                        left: `${(p.x / (R * 2)) * 100}%`, top: `${(p.y / (R * 2)) * 100}%`,
                        transform: "translate(-50%,-50%)",
                        width: isBase ? 34 : 26, height: isBase ? 34 : 26,
                        borderRadius: "50%", background: hexes[i],
                        border: `${isActive ? 4 : 3}px solid #fff`,
                        boxShadow: isActive ? "0 0 0 2px #1A1A1A, 0 2px 6px rgba(0,0,0,0.3)" : "0 1px 4px rgba(0,0,0,0.35)",
                        cursor: "grab", touchAction: "none",
                      }}
                      title={`${i + 1}번 색 ${isBase ? "(기준색)" : ""}`}
                    />
                  );
                })}
              </div>

              {/* 명도 슬라이더 */}
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 12, color: GRAY, marginBottom: 6 }}>
                  {activeIdx + 1}번 색 밝기 <b style={{ color: INK, fontFamily: "monospace" }}>{hexes[activeIdx]}</b>
                </div>
                <input
                  type="range" min="15" max="100" value={Math.round(hsvs[activeIdx].v * 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value) / 100;
                    setHsvs((prev) => {
                      if (mode === "custom") return prev.map((c, k) => (k === activeIdx ? { ...c, v } : c));
                      const off = HARMONIES[mode].offsets[activeIdx];
                      const base = { ...prev[BASE_IDX], v: clamp(v - (off.dv || 0), 0.15, 1) };
                      return applyHarmony(mode, base);
                    });
                  }}
                  style={{ width: "100%", accentColor: hexes[activeIdx] }}
                />
              </div>

              {/* 색상 조화 */}
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  <b>색상 조화:</b> <span style={{ color: GRAY }}>{HARMONIES[mode].label}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Object.entries(HARMONIES).map(([k, hInfo]) => (
                    <button key={k} onClick={() => changeMode(k)} className="harmonyBtn"
                      style={{
                        borderColor: mode === k ? INK : LINE,
                        fontWeight: mode === k ? 700 : 400,
                        background: mode === k ? "#F3F3F0" : "#fff",
                      }}>
                      {hInfo.label}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: GRAY, lineHeight: 1.6, marginTop: 10 }}>
                  가운데 큰 점이 <b>기준색</b>이에요. 조화 규칙을 고르면 나머지 색이 색상환의 원리에 따라 함께 움직입니다.
                  자유롭게 고르고 싶으면 '사용자 정의'를 선택하세요.
                </p>
              </div>
            </div>

            {/* ── 오른쪽: 큰 컬럼 미리보기 ── */}
            <div>
              <div className="cols">
                {hexes.map((hex, i) => (
                  <div key={i} className="col"
                    onClick={() => setActiveIdx(i)}
                    style={{
                      flex: activeIdx === i ? 1.25 : 1, background: hex, position: "relative",
                      cursor: "pointer", transition: "flex .25s",
                      display: "flex", flexDirection: "column", justifyContent: "flex-end",
                    }}>
                    <div style={{ padding: "0 0 18px 14px", color: textColorOn(hex), display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700 }}>{hex}</span>
                      <button
                        className="copyIc"
                        onClick={(e) => { e.stopPropagation(); copyText(hex); }}
                        title="헥스코드 복사"
                        style={{
                          opacity: 0.55, background: "none", border: `1.5px dashed ${textColorOn(hex)}`,
                          color: textColorOn(hex), borderRadius: 5, width: 24, height: 24,
                          cursor: "pointer", fontSize: 12, lineHeight: 1, transition: "opacity .15s",
                        }}>⧉</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 하단 바: 미니 스트립 + 이름 + 버튼들 */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 18 }}>
                <div style={{ display: "flex", width: 150, height: 40, borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}>
                  {hexes.map((h, i) => <div key={i} style={{ flex: 1, background: h }} />)}
                </div>
                <button onClick={() => copyText(hexes.join(", "), "팔레트 전체")} className="harmonyBtn" title="5색 헥스코드 전체 복사">⧉ 전체 복사</button>
                <button onClick={exportJSON} className="harmonyBtn" style={{ fontWeight: 700 }}>⬇ Export JSON</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginTop: 16 }}>
                <input className="field" value={klass} onChange={(e) => setKlass(e.target.value)} placeholder="학반 (예: 2-3)" />
                <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름 또는 닉네임" />
                <input className="field" value={paletteName} onChange={(e) => setPaletteName(e.target.value)} placeholder="팔레트 이름 (예: 여름 쨍쨍)" style={{ gridColumn: "1 / -1" }} />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                <button onClick={submit} disabled={submitting}
                  style={{
                    padding: "13px 30px", fontSize: 15, fontWeight: 700, letterSpacing: "0.02em",
                    background: "#4F46E5", color: "#fff", border: "none", borderRadius: 999,
                    cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.6 : 1, fontFamily: "inherit",
                  }}>
                  {submitting ? "전시 중…" : "내 색상 팔레트로 만들기"}
                </button>
              </div>

              {/* 헥스 직접 입력 */}
              <details style={{ marginTop: 18 }}>
                <summary style={{ fontSize: 13, color: GRAY, cursor: "pointer" }}>헥스코드로 직접 입력하기</summary>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {hexes.map((h, i) => (
                    <input key={i} defaultValue={h}
                      onBlur={(e) => setHexAt(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") setHexAt(i, e.target.value); }}
                      style={{ fontFamily: "monospace", fontSize: 13, width: 92, padding: "8px 10px", border: `1px solid ${LINE}`, borderRadius: 6 }} />
                  ))}
                </div>
              </details>
            </div>
          </section>
        )}

        {/* ══════════ ② 갤러리 ══════════ */}
        {tab === "gallery" && (
          <section>
            {loading ? <p style={{ color: GRAY }}>갤러리를 여는 중…</p>
              : palettes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: GRAY }}>
                  아직 전시된 팔레트가 없어요.<br />첫 번째 작가가 되어 보세요!
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 18 }}>
                  {palettes.map((p) => (
                    <article key={p.key} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                      <div style={{ display: "flex", height: 84 }}>
                        {(p.colors || []).map((c, i) => <div key={i} style={{ flex: 1, background: c }} title={c} />)}
                      </div>
                      <div style={{ padding: "13px 15px" }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{p.title}</div>
                        <div style={{ fontSize: 12, color: GRAY, marginTop: 6 }}>
                          {p.klass ? `${p.klass} · ` : ""}{p.name}{p.harmony ? ` · ${p.harmony}` : ""}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button className="harmonyBtn" style={{ fontSize: 12 }}
                            onClick={() => copyText((p.colors || []).join(", "), `${p.title} 팔레트`)}>⧉ 복사</button>
                          <button className="harmonyBtn" style={{ fontSize: 12 }}
                            onClick={() => {
                              const blob = new Blob([JSON.stringify({ name: p.title, author: p.name, class: p.klass, harmony: p.harmony, colors: p.colors }, null, 2)], { type: "application/json" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url; a.download = `${(p.title || "palette").replace(/\s+/g, "_")}.json`;
                              document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
                              showToast("JSON 파일로 저장했어요");
                            }}>⬇ Export JSON</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
          </section>
        )}

        {/* ══════════ ③ 리히터의 벽 ══════════ */}
        {tab === "wall" && (
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <p style={{ color: GRAY, fontSize: 13, lineHeight: 1.7, maxWidth: 520, margin: 0 }}>
                지금까지 모인 <b style={{ color: INK }}>{allChips.length}개</b>의 색을 무작위로 배열했어요.
                리히터가 그랬듯, 우연이 만든 질서를 감상해 보세요.
              </p>
              <button onClick={() => setWallSeed((s) => s + 1)} className="harmonyBtn">⤨ 다시 섞기</button>
            </div>
            {allChips.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: GRAY }}>색이 모이면 이곳에 벽이 세워집니다.</div>
            ) : (
              <div style={{
                marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))",
                gap: 3, background: "#fff", padding: 14, border: `1px solid ${LINE}`, borderRadius: 10,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}>
                {wallChips.map((c, i) => <div key={i} title={c} style={{ aspectRatio: "1", background: c }} />)}
              </div>
            )}
          </section>
        )}
      </main>

      {toast && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: INK, color: "#fff", padding: "12px 22px", borderRadius: 8,
          fontSize: 14, boxShadow: "0 4px 16px rgba(0,0,0,0.25)", zIndex: 50,
        }}>{toast}</div>
      )}
    </div>
  );
}