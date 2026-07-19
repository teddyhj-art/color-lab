import { useState, useEffect, useRef, useCallback } from "react";

// ── 치평 색채 연구소 v5 ──────────────────────────────────────
// 탭 구성: ① 색채 이론 → ② 색채 배우기 → ③ 팔레트 만들기 → ④ 치평 갤러리 → ⑤ 리히터의 벽

const INK = "#1A1A1A";
const GRAY = "#8B8B85";
const LINE = "#E6E5E0";
const ADMIN_PW = "2026";
const MAX_SUBMIT = 3;

// ─────────────────── 색 변환 유틸 ───────────────────────────
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function hsvToHex(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
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

function rgb2hex(r, g, b) {
  return "#" + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}
function hex2rgb(hex) {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

const textColorOn = (hex) => {
  const hsv = hexToHsv(hex);
  return hsv && hsv.v > 0.62 && !(hsv.s > 0.75 && hsv.v < 0.8) ? "#1A1A1A" : "#FFFFFF";
};

// ─────────────────── 색채 이론 데이터 ───────────────────────
const COLOR_SETS = {
  3: [{ hex: "#FF0000", n: "빨강" }, { hex: "#FFFF00", n: "노랑" }, { hex: "#0000FF", n: "파랑" }],
  5: [{ hex: "#FF0000", n: "빨강" }, { hex: "#FF8000", n: "주황" }, { hex: "#FFFF00", n: "노랑" }, { hex: "#00AA00", n: "초록" }, { hex: "#0000FF", n: "파랑" }],
  10: [{ hex: "#FF0000", n: "빨강" }, { hex: "#FF8000", n: "주황" }, { hex: "#FFFF00", n: "노랑" }, { hex: "#80CC00", n: "연두" }, { hex: "#00AA44", n: "초록" }, { hex: "#00AAAA", n: "청록" }, { hex: "#0066FF", n: "파랑" }, { hex: "#0000AA", n: "남색" }, { hex: "#6600CC", n: "보라" }, { hex: "#CC00AA", n: "자주" }],
};
const COLOR_INFO = {
  3: "빨강·노랑·파랑은 <b>3원색</b>이에요. 어떤 색을 섞어도 만들 수 없는 기본 색입니다.",
  5: "3원색 사이에 <b>2차색</b>(주황·초록)이 추가됐어요. 빨강+노랑=주황, 노랑+파랑=초록이에요.",
  10: "10색상환에서는 색의 관계를 세밀하게 볼 수 있어요. 맞은편 색이 <b>보색</b>, 옆 색이 <b>유사색</b>입니다.",
};
const PRIMARY3 = COLOR_SETS[3];

// ─────────────────── 팔레트 조화 ───────────────────────────
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
  return off.map((o) => ({ h: (base.h + (o.dh || 0) + 360) % 360, s: clamp(base.s + (o.ds || 0), 0.05, 1), v: clamp(base.v + (o.dv || 0), 0.15, 1) }));
}

const shuffleArr = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const getSubmitCount = (no, nm) => { try { return parseInt(localStorage.getItem(`submit_${no}_${nm}`) || "0", 10); } catch { return 0; } };
const incSubmitCount = (no, nm) => { try { const k = `submit_${no}_${nm}`, c = parseInt(localStorage.getItem(k) || "0", 10); localStorage.setItem(k, String(c + 1)); return c + 1; } catch { return 1; } };

// ════════════════════════════════════════════════════════════
// ① 색채 이론 워크시트 탭 컴포넌트
// ════════════════════════════════════════════════════════════
function WorksheetTab() {
  const [openBlanks, setOpenBlanks] = useState({});
  const [folds, setFolds] = useState({});
  const mixCmyRef = useRef(null);
  const mixRgbRef = useRef(null);

  const tb = (id) => setOpenBlanks(prev => ({ ...prev, [id]: !prev[id] }));
  const tf = (id) => setFolds(prev => ({ ...prev, [id]: !prev[id] }));

  const totalBlanks = 42;
  const openCount = Object.values(openBlanks).filter(Boolean).length;
  const pct = Math.round((openCount / totalBlanks) * 100);

  const openAll = () => {
    const all = {};
    for (let i = 0; i < totalBlanks; i++) all[i] = true;
    setOpenBlanks(all);
  };
  const closeAll = () => setOpenBlanks({});

  // Canvas 혼합 다이어그램
  useEffect(() => {
    function drawMix(canvas, bg, c0, c1, c2, o01, o02, o12, center, labels) {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const W = canvas.width, H = canvas.height;
      ctx.fillStyle = bg;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(0, 0, W, H, 8); else ctx.rect(0, 0, W, H);
      ctx.fill();
      [c0, c1, c2].forEach(c => { ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fillStyle = c.col; ctx.fill(); });
      const img = ctx.getImageData(0, 0, W, H); const d = img.data;
      const inC = (px, py, c) => (px - c.x) ** 2 + (py - c.y) ** 2 <= c.r * c.r;
      const hx = h => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
      const h01 = hx(o01), h02 = hx(o02), h12 = hx(o12), hc = hx(center);
      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const i0 = inC(px, py, c0), i1 = inC(px, py, c1), i2 = inC(px, py, c2);
          const idx = (py * W + px) * 4;
          let col = null;
          if (i0 && i1 && i2) col = hc;
          else if (i0 && i1) col = h01;
          else if (i0 && i2) col = h02;
          else if (i1 && i2) col = h12;
          if (col) { d[idx] = col[0]; d[idx + 1] = col[1]; d[idx + 2] = col[2]; d[idx + 3] = 255; }
        }
      }
      ctx.putImageData(img, 0, 0);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      labels.forEach(({ t, x, y, c, s, w }) => { ctx.font = (w ? "bold " : "") + (s || 10) + "px sans-serif"; ctx.fillStyle = c; ctx.fillText(t, x, y); });
    }
    drawMix(mixCmyRef.current, "#ffffff",
      { x: 90, y: 63, r: 58, col: "#FFFF00" }, { x: 60, y: 117, r: 58, col: "#00FFFF" }, { x: 120, y: 117, r: 58, col: "#FF00FF" },
      "#00FF00", "#FF0000", "#0000FF", "#000000",
      [{ t: "Yellow", x: 90, y: 14, c: "#888800", s: 11, w: true }, { t: "Cyan", x: 24, y: 158, c: "#007799", s: 11, w: true }, { t: "Magenta", x: 156, y: 158, c: "#AA0077", s: 11, w: true },
       { t: "Green", x: 63, y: 82, c: "#fff", s: 9 }, { t: "Red", x: 117, y: 82, c: "#fff", s: 9 }, { t: "Blue", x: 90, y: 135, c: "#fff", s: 9 }, { t: "Black", x: 90, y: 108, c: "#fff", s: 10, w: true }]
    );
    drawMix(mixRgbRef.current, "#111111",
      { x: 90, y: 63, r: 58, col: "#FF0000" }, { x: 60, y: 117, r: 58, col: "#00FF00" }, { x: 120, y: 117, r: 58, col: "#0000FF" },
      "#FFFF00", "#FF00FF", "#00FFFF", "#FFFFFF",
      [{ t: "Red", x: 90, y: 14, c: "#FF9999", s: 11, w: true }, { t: "Green", x: 24, y: 158, c: "#99FF99", s: 11, w: true }, { t: "Blue", x: 156, y: 158, c: "#9999FF", s: 11, w: true },
       { t: "Yellow", x: 63, y: 82, c: "#333", s: 9 }, { t: "Magenta", x: 117, y: 82, c: "#333", s: 9 }, { t: "Cyan", x: 90, y: 135, c: "#333", s: 9 }, { t: "White", x: 90, y: 108, c: "#333", s: 10, w: true }]
    );
  }, []);

  // 스타일 헬퍼
  const S = {
    ch: { marginBottom: 28 },
    chTitle: { fontSize: 15, fontWeight: 700, padding: "5px 10px", borderLeft: "4px solid #3B82F6", marginBottom: 12, background: "#fff", borderRadius: "0 8px 8px 0" },
    card: { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10 },
    foldBtn: (open) => ({ width: "100%", background: open ? "#EFF6FF" : "#F7F7F5", border: `1px solid ${open ? "#93C5FD" : LINE}`, borderRadius: open ? "10px 10px 0 0" : 10, padding: "10px 14px", fontSize: 13.5, fontWeight: 500, color: INK, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "inherit", marginBottom: open ? 0 : 6 }),
    foldBody: { background: "#fff", border: `1px solid ${LINE}`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "12px 16px", marginBottom: 6 },
    blank: (id, type) => {
      const isOpen = openBlanks[id];
      const colors = { default: { bg: "#EFF6FF", border: "#93C5FD", text: "#1D4ED8" }, r: { bg: "#FEF2F2", border: "#FCA5A5", text: "#B91C1C" }, g: { bg: "#F0FDF4", border: "#86EFAC", text: "#15803D" } };
      const col = colors[type || "default"];
      return { display: "inline-block", background: col.bg, border: `1px solid ${col.border}`, borderRadius: 5, padding: "1px 10px", fontSize: 13, fontWeight: 700, color: isOpen ? col.text : "transparent", cursor: "pointer", minWidth: 42, textAlign: "center", verticalAlign: "middle", userSelect: "none", transition: "color .15s" };
    },
  };

  let bId = 0;
  const Blank = ({ children, type }) => { const id = bId++; return <span style={S.blank(id, type)} onClick={() => tb(id)}>{children}</span>; };
  const Fold = ({ fid, label, children }) => (
    <div style={{ marginBottom: 6 }}>
      <button style={S.foldBtn(folds[fid])} onClick={() => tf(fid)}>
        <span>{label}</span><span style={{ fontSize: 11, color: GRAY, display: "inline-block", transform: folds[fid] ? "rotate(180deg)" : "none", transition: "transform .25s" }}>▼</span>
      </button>
      {folds[fid] && <div style={S.foldBody}>{children}</div>}
    </div>
  );

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: GRAY, letterSpacing: ".1em", marginBottom: 3 }}>치평중학교 미술 · 색채 이론 워크시트</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>색이란 무엇인가</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button onClick={openAll} style={{ border: "1px solid #3B82F6", background: "#fff", color: "#1D4ED8", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>모든 빈칸 열기</button>
            <button onClick={closeAll} style={{ border: `1px solid ${LINE}`, background: "#fff", color: GRAY, borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>모든 빈칸 닫기</button>
          </div>
          <div style={{ fontSize: 11, color: GRAY, marginTop: 4 }}>{openCount} / {totalBlanks} 확인 완료 ({pct}%) &nbsp;|&nbsp; 1번 클릭 → 열기 &nbsp;|&nbsp; 2번 클릭 → 닫기</div>
        </div>
      </div>
      <div style={{ height: 4, background: LINE, borderRadius: 2, marginBottom: 20 }}>
        <div style={{ height: 4, background: "#3B82F6", borderRadius: 2, width: pct + "%", transition: "width .3s" }} />
      </div>

      {/* ① 색이란 무엇인가 */}
      <div style={S.ch}>
        <div style={S.chTitle}>① 색이란 무엇인가</div>
        <Fold fid="f1" label="색의 정의 — 빛·물체·관찰자">
          <p style={{ fontSize: 13, color: GRAY, lineHeight: 1.8, marginBottom: 8 }}>색을 전문적으로 정의할 때는 보통 3가지 요소를 포함해 정의합니다.</p>
          <div style={{ background: "#EFF6FF", border: "1px solid #93C5FD", borderRadius: 10, padding: "10px 14px", textAlign: "center", fontSize: 13, lineHeight: 1.8, marginBottom: 8 }}>
            색은 <b>관찰자</b>가 관여해서 대상물체의 특성을 <b>광원</b>으로부터 나온 특정 <b>빛</b>을 통해 느끼게 되는 <b>감각적 이벤트</b>이다
          </div>
          <p style={{ fontSize: 13, color: GRAY, lineHeight: 1.8 }}>즉, 색을 이야기할 때 우리는 <b style={{ color: "#1D4ED8" }}>빛 / 물체 / 관찰자</b> 라는 3가지 요소를 고려해야 합니다.</p>
        </Fold>
        <Fold fid="f2" label="색은 물체·빛·관찰자에 관한 것">
          <p style={{ fontSize: 13, color: GRAY, lineHeight: 1.8, marginBottom: 6 }}><b style={{ color: "#1D4ED8" }}>색은 물체에 관한 것</b>입니다. '빨간 사과', '노란 병아리'처럼 우리는 물건을 색으로 표현하곤 하죠.</p>
          <p style={{ fontSize: 13, color: GRAY, lineHeight: 1.8, marginBottom: 6 }}><b style={{ color: "#1D4ED8" }}>색상은 빛의 특성</b>입니다. 빛이 없으면 아무런 색도 있을 수 없어요.</p>
          <p style={{ fontSize: 13, color: GRAY, lineHeight: 1.8 }}><b style={{ color: "#1D4ED8" }}>색은 관찰자에 관한 것</b>이기도 합니다. 뇌에 자극을 가하면 물체나 빛은 그대로인데 인식하는 색만 변한답니다.</p>
        </Fold>
      </div>

      {/* ② 색의 3요소 */}
      <div style={S.ch}>
        <div style={S.chTitle}>② 색의 3요소</div>
        <div style={S.card}>
          <p style={{ fontSize: 13.5, color: GRAY, lineHeight: 1.8 }}>색을 구분·분석하는 방법은 3가지를 기준으로 하는데, 그것이 바로 색의 3요소(<Blank type="default">색상</Blank>, <Blank type="r">명도</Blank>, <Blank type="g">채도</Blank>)이다.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, margin: "10px 0" }}>
          {[
            { title: "색상 (Hue)", color: "#1D4ED8", bg: "linear-gradient(to right,#FF0000,#FFFF00,#00CC00,#0000FF,#FF00FF,#FF0000)", desc: <span>색깔 그 자체. 색을 <Blank>구분</Blank>하는 속성.<br/>유채색 = <Blank>색상이 있는</Blank> 색<br/>무채색 = <Blank>흰·회·검</Blank>처럼 색상 없는 색</span> },
            { title: "명도 (Brightness)", color: "#B91C1C", bg: "linear-gradient(to right,#000,#888,#fff)", desc: <span>색의 <Blank type="r">밝기</Blank>.<br/>빛 세기 강할수록 명도 <Blank type="r">높고</Blank><br/>약할수록 명도 <Blank type="r">낮아짐</Blank></span> },
            { title: "채도 (Saturation)", color: "#15803D", bg: "linear-gradient(to right,#888,#FF2222)", desc: <span>색의 <Blank type="g">순도·선명도</Blank>.<br/>다른 색이 섞일수록 채도 <Blank type="g">낮아짐</Blank><br/>최종 0이 되면 <Blank type="g">무채색</Blank></span> },
          ].map(({ title, color, bg, desc }) => (
            <div key={title} style={{ borderRadius: 10, border: `1px solid ${LINE}`, padding: "12px", textAlign: "center", background: "#fff" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color, marginBottom: 6 }}>{title}</div>
              <div style={{ height: 36, borderRadius: 7, background: bg, margin: "5px 0", border: title.includes("명도") ? `1px solid ${LINE}` : "none" }} />
              <div style={{ fontSize: 11.5, color: GRAY, lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
        <Fold fid="f3" label="무채색과 유채색 자세히 보기">
          <p style={{ fontSize: 13, color: GRAY, lineHeight: 1.8, marginBottom: 4 }}><b>무채색</b>: 흰색·회색·검정. 빛의 밝기에 따라 결정되는 색으로 색상이 없다.</p>
          <p style={{ fontSize: 13, color: GRAY, lineHeight: 1.8, marginBottom: 4 }}><b>유채색</b>: 색상이 있는 색깔. 기본적으로 빨강(R)·초록(G)·파랑(B)가 색의 삼원색이다.</p>
          <p style={{ fontSize: 13, color: "#B91C1C", lineHeight: 1.8, marginBottom: 2 }}>물감은 <b>감산혼합</b> — 섞을수록 '채도'가 낮아진다.</p>
          <p style={{ fontSize: 13, color: "#15803D", lineHeight: 1.8 }}>빛은 <b>가산혼합</b> — 섞을수록 '명도'가 높아진다.</p>
        </Fold>
      </div>

      {/* ③ 빛 vs 물감 혼합 */}
      <div style={S.ch}>
        <div style={S.chTitle}>③ 빛의 혼합 vs 물감의 혼합</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "10px 0" }}>
          {[
            { id: "cmy", ref: mixCmyRef, head: "감산혼합 표 (CMYK)", headBg: "#222", dots: [["#00FFFF","C"],["#FF00FF","M"],["#FFFF00 border:1px solid #ccc","Y"]], result: "Black", blanks: [["r","시안(C)"],["r","마젠타(M)"],["r","노랑(Y)"],["r","검정(Black)"],["r","어두워진다"]], usage: "인쇄·프린터" },
            { id: "rgb", ref: mixRgbRef, head: "가산혼합 표 (RGB)", headBg: "#111", dots: [["#FF0000","R"],["#00FF00","G"],["#0000FF","B"]], result: "White", blanks: [["g","빨강(R)"],["g","초록(G)"],["g","파랑(B)"],["g","흰색(White)"],["g","밝아진다"]], usage: "모니터·TV·스마트폰" },
          ].map(({ id, ref, head, headBg, dots, result, blanks, usage }) => (
            <div key={id} style={{ borderRadius: 10, border: `1px solid ${LINE}`, overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", fontSize: 13, fontWeight: 700, color: "#fff", textAlign: "center", background: headBg }}>{head}</div>
              <div style={{ padding: "12px 12px 14px", background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                  <canvas ref={ref} width={180} height={180} style={{ borderRadius: 8 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: GRAY, marginBottom: 6 }}>
                  {dots.map(([col, label]) => <span key={label} style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: col.split(" ")[0], border: col.includes("border") ? "1px solid #ccc" : "none", display: "inline-block" }} />{label}</span>)}
                  <span>→ 모두 섞으면 <b>{result}</b></span>
                </div>
                <div style={{ fontSize: 12, color: GRAY, lineHeight: 1.7 }}>
                  3원색: <Blank type={blanks[0][0]}>{blanks[0][1]}</Blank> <Blank type={blanks[1][0]}>{blanks[1][1]}</Blank> <Blank type={blanks[2][0]}>{blanks[2][1]}</Blank><br />
                  모두 섞으면 → <Blank type={blanks[3][0]}>{blanks[3][1]}</Blank><br />
                  섞을수록 <Blank type={blanks[4][0]}>{blanks[4][1]}</Blank> · 사용: <b>{usage}</b>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Fold fid="f4" label="물감과 빛이 다른 이유 자세히 보기">
          <p style={{ fontSize: 13, color: GRAY, lineHeight: 1.8, marginBottom: 4 }}>물감과 빛이 성질이 다른 것은 애초에 서로 완전히 다른 물질을 가지고 분석하기 때문이다.</p>
          <p style={{ fontSize: 13, color: "#B91C1C", lineHeight: 1.8, marginBottom: 2 }}><b>물감 = 감산혼합</b>: 섞을수록 색깔이 변하면서 동시에 '채도'가 낮아진다.</p>
          <p style={{ fontSize: 13, color: "#15803D", lineHeight: 1.8 }}><b>빛 = 가산혼합</b>: 섞을수록 색깔이 변하면서 동시에 '명도'가 높아진다.</p>
        </Fold>
      </div>

      {/* ④ 색의 대비 */}
      <div style={S.ch}>
        <div style={S.chTitle}>④ 색의 대비</div>
        <div style={S.card}>
          <p style={{ fontSize: 13.5, color: GRAY, lineHeight: 1.8, marginBottom: 4 }}>색의 대비는 <b>두 가지 이상의 색을 인접하게 배치하거나 연속하여 볼 때, 서로의 영향을 받아 실제 색보다 훨씬 강조되어 다르게 보이는 시각적 현상</b>입니다.</p>
          <p style={{ fontSize: 12.5, color: GRAY, lineHeight: 1.8 }}>이는 주로 우리 눈의 <b>망막</b>과 뇌의 <b>신경 처리 과정</b>에서 발생하는 <b>생리적 착시 현상</b>입니다.</p>
        </div>
        {[
          { label: "명도 대비", bg: "#444", def: <span>밝고 어두운 색이 인접했을 때, 밝은 색은 더 <Blank>밝게</Blank>, 어두운 색은 더 <Blank>어둡게</Blank> 보이는 현상.</span>, demo: [["#111","#888"],["#eee","#888"]], note: "같은 회색인데 왼쪽이 더 밝아 보인다" },
          { label: "색상 대비", bg: "#CC5500", def: <span>인접한 두 색의 영향으로 본래의 <Blank>색상</Blank>과 <Blank>달라져</Blank> 보이는 현상.</span>, demo: [["#CC0000","#FFA500"],["#FFFF00","#FFA500"]], note: "같은 귤색 → 빨강 위엔 노랗게, 노랑 위엔 주황으로" },
          { label: "채도 대비", bg: "#337700", def: <span>채도 높은 색은 더 <Blank type="g">선명해</Blank> 보이고, 낮은 색은 더 <Blank type="g">탁해</Blank> 보이는 현상.</span>, demo: [["#FFCC00","#CC6600"],["#AAAAAA","#CC6600"]], note: "회색 바탕 위에서 더 선명해 보인다" },
          { label: "보색 대비", bg: "#0055AA", def: <span>보색 관계인 두 색을 나란히 배치 시 <Blank>채도</Blank>가 높아져 더 <Blank>강렬하고 선명하게</Blank> 보이는 현상.</span>, demo: [["#00AACC","#FF0000"],["#FFFF00","#8800FF"]], note: "보색 배치 시 서로 더 강렬해 보인다" },
          { label: "한난 대비", bg: "#7700AA", def: <span><Blank>차가운</Blank> 색 옆에서는 더 차갑게, <Blank>따뜻한</Blank> 색 옆에서는 더 따뜻하게 보이는 현상.</span>, demo: [["#00AAFF","#FF4400"],["#FFDD00","#00AA44"]], note: "파랑 위의 빨강은 더 뜨겁게 보인다" },
          { label: "면적 대비", bg: "#886600", def: <span>동일한 색이라도 <Blank>면적의 크기</Blank>에 따라 명도와 채도가 달라져 보이는 현상.</span>, demo: null, note2: "큰 면적이 더 밝고 선명해 보인다 / 연변 대비: 경계부분이 더 대비 강해 보임" },
        ].map(({ label, bg, def, demo, note, note2 }) => (
          <div key={label} style={{ borderRadius: 10, border: `1px solid ${LINE}`, background: "#fff", overflow: "hidden", display: "flex", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 70, padding: "10px 8px", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0, textAlign: "center", lineHeight: 1.4, background: bg }}>{label}</div>
            <div style={{ padding: "10px 14px", flex: 1 }}>
              <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.65, marginBottom: 6 }}>{def}</div>
              {demo ? (
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  {demo.map(([sq, inner], i) => (
                    <div key={i} style={{ width: 30, height: 30, borderRadius: 4, background: sq, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 2, background: inner }} />
                    </div>
                  ))}
                  <span style={{ fontSize: 10.5, color: GRAY }}>{note}</span>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ width: 44, height: 26, background: "#FF6644", borderRadius: 3, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: GRAY }}>vs</span>
                  <div style={{ width: 18, height: 18, background: "#FF6644", borderRadius: 3, flexShrink: 0 }} />
                  <span style={{ fontSize: 10.5, color: GRAY }}>{note2}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        <Fold fid="f5" label="색의 관계 — 보색·반대색·유사색">
          <p style={{ fontSize: 13, color: GRAY, lineHeight: 1.8, marginBottom: 4 }}><b>보색:</b> 색상환에서 정반대에 위치한 두 색. 섞으면 바로 무채색으로 변하는 색.</p>
          <p style={{ fontSize: 13, color: GRAY, lineHeight: 1.8, marginBottom: 4 }}><b>반대색:</b> 색상환에서 거리가 먼 색.</p>
          <p style={{ fontSize: 13, color: GRAY, lineHeight: 1.8, marginBottom: 6 }}><b>유사색:</b> 색상환에서 가까이 붙어있는 색상들.</p>
          <p style={{ fontSize: 13, color: "#B91C1C", fontWeight: 700, lineHeight: 1.7 }}>결론: 디자인에서는 3개 정도의 유사색으로 통일성을 만들고, 강조 문구는 보색·명도·채도 대비를 이용한다.</p>
        </Fold>
      </div>

      {/* ⑤ 색상의 감정 */}
      <div style={S.ch}>
        <div style={S.chTitle}>⑤ 색상의 감정·이미지</div>
        <Fold fid="f6" label="색상별 감정·연상 이미지 보기">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(86px,1fr))", gap: 6, margin: "8px 0" }}>
            {[["#BB0000","빨강","정열·흥분·피·위험"],["#EE6600","주황","온정·풍부·활기"],["#BBAA00","노랑","희망·명랑·질투·발전","#222"],["#005500","초록","평화·안전·성장·순정"],["#003399","파랑","침정·냉정·숭고·고집"],["#440066","보라","창조·우아·예술·신비"]].map(([c,n,d,tc])=>(
              <div key={n} style={{ borderRadius: 8, height: 50, background: c, display: "flex", alignItems: "flex-end", padding: "4px 6px", fontSize: 11, fontWeight: 700, color: tc || "rgba(255,255,255,.92)" }}>
                {n}<br/><span style={{ fontSize: 9.5, fontWeight: 400, opacity: .85 }}>{d}</span>
              </div>
            ))}
          </div>
        </Fold>
      </div>

      {/* ⑥ 최종 정리 퀴즈 */}
      <div style={S.ch}>
        <div style={S.chTitle}>⑥ 최종 정리 퀴즈</div>
        <div style={S.card}>
          {[
            <span>1. 색의 3요소는 <Blank>색상</Blank>, <Blank type="r">명도</Blank>, <Blank type="g">채도</Blank> 이다.</span>,
            <span>2. 색상이 없는 색(흰색·회색·검정)을 <Blank>무채색</Blank>이라고 한다.</span>,
            <span>3. 빛의 3원색은 <Blank type="g">RGB</Blank>이며, 모두 섞으면 <Blank type="g">흰색</Blank>이 된다. → <Blank type="g">가산</Blank>혼합</span>,
            <span>4. 물감의 3원색은 <Blank type="r">CMY</Blank>이며, 모두 섞으면 <Blank type="r">검정</Blank>이 된다. → <Blank type="r">감산</Blank>혼합</span>,
            <span>5. 어두운 바탕 위 포인트가 더 밝아 보이는 현상은 <Blank>명도 대비</Blank>이다.</span>,
            <span>6. 보색 관계의 두 색을 나란히 놓으면 더욱 <Blank>선명하고 화려해</Blank> 보인다.</span>,
            <span>7. 물감을 섞을수록 채도가 낮아지는 혼합은 <Blank type="r">감산혼합</Blank>이다.</span>,
            <span>8. 색상환에서 정반대 두 색을 <Blank>보색</Blank>, 가까이 있는 색을 <Blank>유사색</Blank>이라 한다.</span>,
          ].map((q, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "6px 0", fontSize: 12.5, color: GRAY, flexWrap: "wrap" }}>{q}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ② 색채 배우기 탭 컴포넌트
// ════════════════════════════════════════════════════════════
function LearnTab() {
  const [colorN, setColorN] = useState(3);
  const [vHex, setVHex] = useState("#FF0000");
  const [vVal, setVVal] = useState(0);
  const [cHex, setCHex] = useState("#FF0000");
  const [cVal, setCVal] = useState(100);
  const [tHex, setTHex] = useState("#FF0000");
  const [tV, setTV] = useState(0);
  const [tC, setTC] = useState(100);
  const wheelRef = useRef(null);

  // 분절 색상환 그리기
  useEffect(() => {
    const canvas = wheelRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = 220, CX = 110, CY = 110, R = 104, R2 = 54, GAP = 0.055;
    ctx.clearRect(0, 0, W, W);
    const colors = COLOR_SETS[colorN];
    const total = colors.length;
    const slice = (2 * Math.PI) / total;

    colors.forEach(({ hex, n }, i) => {
      const start = -Math.PI / 2 + i * slice + GAP / 2;
      const end = -Math.PI / 2 + (i + 1) * slice - GAP / 2;
      ctx.beginPath();
      ctx.arc(CX, CY, R, start, end);
      ctx.arc(CX, CY, R2, end, start, true);
      ctx.closePath();
      ctx.fillStyle = hex;
      ctx.fill();
      const midA = (start + end) / 2;
      const lr = R2 + (R - R2) * 0.56;
      ctx.fillStyle = "rgba(0,0,0,0.82)";
      ctx.font = `bold ${total <= 5 ? 14 : 11}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n, CX + lr * Math.cos(midA), CY + lr * Math.sin(midA));
    });

    // 중앙 원
    ctx.beginPath(); ctx.arc(CX, CY, R2 - 1, 0, 2 * Math.PI); ctx.fillStyle = "#999"; ctx.fill();
    ctx.beginPath(); ctx.arc(CX, CY, R2 - 3, 0, 2 * Math.PI); ctx.fillStyle = "#fff"; ctx.fill();

    // 3·5색 화살표
    if (colorN <= 5) {
      colors.forEach((_, i) => {
        const midA = -Math.PI / 2 + i * slice + slice / 2;
        const x1 = CX + 10 * Math.cos(midA), y1 = CY + 10 * Math.sin(midA);
        const x2 = CX + (R2 - 7) * Math.cos(midA), y2 = CY + (R2 - 7) * Math.sin(midA);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - 9 * Math.cos(midA) + 5 * Math.cos(midA - Math.PI / 2), y2 - 9 * Math.sin(midA) + 5 * Math.sin(midA - Math.PI / 2));
        ctx.lineTo(x2 - 9 * Math.cos(midA) + 5 * Math.cos(midA + Math.PI / 2), y2 - 9 * Math.sin(midA) + 5 * Math.sin(midA + Math.PI / 2));
        ctx.closePath(); ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fill();
      });
    }
  }, [colorN]);

  // 명도 계산
  const getVMixed = (hex, v) => {
    const b = hex2rgb(hex);
    if (v >= 0) return rgb2hex(b.r + (255 - b.r) * (v / 100), b.g + (255 - b.g) * (v / 100), b.b + (255 - b.b) * (v / 100));
    return rgb2hex(b.r * (1 + v / 100), b.g * (1 + v / 100), b.b * (1 + v / 100));
  };

  // 채도 계산
  const getCMixed = (hex, v) => {
    const b = hex2rgb(hex); const g = 128, t = v / 100;
    return rgb2hex(b.r * t + g * (1 - t), b.g * t + g * (1 - t), b.b * t + g * (1 - t));
  };

  // 색조 계산
  const getTMixed = (hex, v, c) => {
    const b = hex2rgb(hex); const g = 128, t = c / 100;
    let r = b.r * t + g * (1 - t), gr = b.g * t + g * (1 - t), bl = b.b * t + g * (1 - t);
    if (v > 0) { r = r + (255 - r) * (v / 100); gr = gr + (255 - gr) * (v / 100); bl = bl + (255 - bl) * (v / 100); }
    else if (v < 0) { r = r * (1 + v / 100); gr = gr * (1 + v / 100); bl = bl * (1 + v / 100); }
    return rgb2hex(r, gr, bl);
  };

  const toneLabel = (v, c) => {
    if (c > 75 && v > 25) return "명청색 — 순색에 흰색이 섞인 밝은 색";
    if (c > 75 && v < -25) return "암청색 — 순색에 검정이 섞인 어두운 색";
    if (c > 75) return "순색에 가까운 색 (고채도)";
    if (c < 30) return "탁색 — 회색이 많이 섞인 낮은 채도의 색";
    if (v > 20) return "밝은 탁색 — 파스텔 계열";
    if (v < -20) return "어두운 탁색 — 다크·차분한 계열";
    return "중간 채도의 탁색";
  };

  const getConcepts = (hex) => {
    const b = hex2rgb(hex); const g = 128;
    return [
      { n: "순색", d: "아무것도 섞지 않은\n원래의 색", c: hex },
      { n: "명청색", d: "순색 + 흰색\n밝고 가벼운 느낌", c: rgb2hex(b.r + (255 - b.r) * .55, b.g + (255 - b.g) * .55, b.b + (255 - b.b) * .55) },
      { n: "암청색", d: "순색 + 검정\n무겁고 깊은 느낌", c: rgb2hex(b.r * .32, b.g * .32, b.b * .32) },
      { n: "탁색", d: "순색 + 회색\n차분하고 세련된", c: rgb2hex(b.r * .38 + g * .62, b.g * .38 + g * .62, b.b * .38 + g * .62) },
      { n: "밝은 탁색", d: "파스텔 계열\n순색+흰색+회색", c: rgb2hex(b.r * .32 + 255 * .68, b.g * .32 + 255 * .68, b.b * .32 + 255 * .68) },
      { n: "어두운 탁색", d: "다크·복잡한 톤\n순색+검정+회색", c: rgb2hex(b.r * .22 + g * .12, b.g * .22 + g * .12, b.b * .22 + g * .12) },
    ];
  };

  const secStyle = { marginBottom: 32 };
  const secTitle = { fontSize: 13, fontWeight: 700, color: GRAY, letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase" };
  const card = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "18px 20px", marginBottom: 12 };
  const tabBtnStyle = (on) => ({ border: `1px solid ${on ? INK : LINE}`, background: on ? INK : "#fff", color: on ? "#fff" : INK, borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: on ? 700 : 400 });
  const baseChip = (hex, n, selected, onClick) => (
    <div key={hex} style={{ textAlign: "center" }}>
      <div onClick={onClick} style={{ width: 38, height: 38, borderRadius: 8, background: hex, border: selected ? `3px solid ${INK}` : `1px solid ${LINE}`, cursor: "pointer", outline: selected ? `2px solid ${INK}` : "none", outlineOffset: 2 }} title={n} />
      <div style={{ fontSize: 10, color: GRAY, marginTop: 2 }}>{n}</div>
    </div>
  );
  const toneStrip = (getColor) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginTop: 8 }}>
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} style={{ height: 32, borderRadius: 6, border: `0.5px solid ${LINE}`, background: getColor(i / 6) }} />
      ))}
    </div>
  );

  return (
    <div>
      {/* 01 색상환 */}
      <div style={secStyle}>
        <div style={secTitle}>01 색상환 — 클릭해서 색 수를 바꿔보세요</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[3, 5, 10].map(n => (
            <button key={n} style={tabBtnStyle(colorN === n)} onClick={() => setColorN(n)}>
              {n === 3 ? "3색 (3원색)" : n === 5 ? "5색" : "10색상환"}
            </button>
          ))}
        </div>
        <div style={{ ...card, display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
          <canvas ref={wheelRef} width={220} height={220} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {COLOR_SETS[colorN].map(({ hex, n }) => (
                <div key={hex} style={{ textAlign: "center" }}>
                  <div style={{ width: colorN <= 5 ? 42 : 28, height: colorN <= 5 ? 42 : 28, borderRadius: 8, background: hex, border: `1.5px solid rgba(0,0,0,0.12)` }} />
                  <div style={{ fontSize: 10, color: GRAY, marginTop: 2 }}>{n}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, color: GRAY, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: COLOR_INFO[colorN] }} />
          </div>
        </div>
      </div>

      {/* 02 명도 */}
      <div style={secStyle}>
        <div style={secTitle}>02 명도 — 흰색·검정을 섞어 밝기를 바꿔보세요</div>
        <div style={card}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {PRIMARY3.map(({ hex, n }) => baseChip(hex, n, vHex === hex, () => { setVHex(hex); setVVal(0); }))}
          </div>
          <div style={{ width: "100%", height: 68, borderRadius: 10, border: `1px solid ${LINE}`, background: getVMixed(vHex, vVal), marginBottom: 12, transition: "background .15s" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: GRAY }}>검정 ◀</span>
            <input type="range" min={-100} max={100} value={vVal} onChange={e => setVVal(Number(e.target.value))} style={{ flex: 1, accentColor: getVMixed(vHex, vVal) }} />
            <span style={{ fontSize: 12, color: GRAY }}>▶ 흰색</span>
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 36, textAlign: "right" }}>{vVal > 0 ? "+" + vVal : vVal === 0 ? "±0" : vVal}</span>
          </div>
          {toneStrip(t => {
            const tv = t * 2 - 1;
            const b = hex2rgb(vHex);
            if (tv >= 0) return rgb2hex(b.r + (255 - b.r) * tv, b.g + (255 - b.g) * tv, b.b + (255 - b.b) * tv);
            return rgb2hex(b.r * (1 + tv), b.g * (1 + tv), b.b * (1 + tv));
          })}
          <div style={{ marginTop: 10, fontSize: 13, color: GRAY, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: vVal > 35 ? "<b>명청색</b> — 흰색이 많이 섞인 밝은 색이에요. 가볍고 경쾌한 느낌입니다." : vVal < -35 ? "<b>암청색</b> — 검정이 섞여 어두워진 색이에요. 무겁고 깊은 느낌입니다." : "슬라이더를 양쪽으로 움직여 명청색·암청색을 만들어 보세요." }} />
        </div>
      </div>

      {/* 03 채도 */}
      <div style={secStyle}>
        <div style={secTitle}>03 채도 — 회색을 섞어 선명도를 바꿔보세요</div>
        <div style={card}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {PRIMARY3.map(({ hex, n }) => baseChip(hex, n, cHex === hex, () => { setCHex(hex); setCVal(100); }))}
          </div>
          <div style={{ width: "100%", height: 68, borderRadius: 10, border: `1px solid ${LINE}`, background: getCMixed(cHex, cVal), marginBottom: 12, transition: "background .15s" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: GRAY }}>회색 ◀</span>
            <input type="range" min={0} max={100} value={cVal} onChange={e => setCVal(Number(e.target.value))} style={{ flex: 1, accentColor: getCMixed(cHex, cVal) }} />
            <span style={{ fontSize: 12, color: GRAY }}>▶ 순색</span>
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 36, textAlign: "right" }}>{cVal}%</span>
          </div>
          {toneStrip(t => {
            const b = hex2rgb(cHex); const g = 128;
            return rgb2hex(b.r * t + g * (1 - t), b.g * t + g * (1 - t), b.b * t + g * (1 - t));
          })}
          <div style={{ marginTop: 10, fontSize: 13, color: GRAY, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: cVal < 30 ? "<b>탁색</b> — 회색이 많이 섞여 채도가 낮아졌어요. 차분하고 세련된 느낌이에요." : cVal > 75 ? "<b>순색(고채도)</b>에 가까워요. 색이 선명하고 강렬합니다." : "슬라이더를 왼쪽으로 움직이면 회색이 섞여 탁색이 됩니다." }} />
        </div>
      </div>

      {/* 04 색조 개념 */}
      <div style={secStyle}>
        <div style={secTitle}>04 색조 — 명청색·암청색·탁색 개념</div>
        <div style={card}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {PRIMARY3.map(({ hex, n }) => baseChip(hex, n, tHex === hex, () => setTHex(hex)))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {getConcepts(tHex).map(({ n, d, c }) => (
              <div key={n} style={{ borderRadius: 10, border: `1px solid ${LINE}`, padding: "10px 12px" }}>
                <div style={{ height: 44, borderRadius: 6, background: c, marginBottom: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{n}</div>
                <div style={{ fontSize: 11, color: GRAY, lineHeight: 1.5, whiteSpace: "pre-line" }}>{d}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>직접 만들어보기</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {PRIMARY3.map(({ hex, n }) => baseChip(hex, n, tHex === hex, () => { setTHex(hex); setTV(0); setTC(100); }))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: GRAY, minWidth: 36 }}>명도</span>
            <input type="range" min={-80} max={80} value={tV} onChange={e => setTV(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 36, textAlign: "right" }}>{tV > 0 ? "+" + tV : tV}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: GRAY, minWidth: 36 }}>채도</span>
            <input type="range" min={0} max={100} value={tC} onChange={e => setTC(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 36, textAlign: "right" }}>{tC}%</span>
          </div>
          <div style={{ width: "100%", height: 56, borderRadius: 8, border: `1px solid ${LINE}`, background: getTMixed(tHex, tV, tC), transition: "background .15s" }} />
          <div style={{ marginTop: 8, fontSize: 13, color: GRAY }}>
            현재 색조: <b style={{ color: INK }}>{toneLabel(tV, tC)}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ④ 리히터의 벽 탭 컴포넌트
// ════════════════════════════════════════════════════════════
function WallTab({ allChips, wallSeed, setWallSeed }) {
  const canvasRef = useRef(null);

  // 편집 옵션 상태
  const [cols, setCols] = useState(10);          // 열 수 (가로 칸 수)
  const [chipSize, setChipSize] = useState(60);  // 칸 크기 (px, 인쇄용)
  const [gap, setGap] = useState(4);             // 칸 사이 간격
  const [showLabel, setShowLabel] = useState(false); // 헥스 라벨 표시
  const [bgColor, setBgColor] = useState("#FFFFFF"); // 배경색
  const [title, setTitle] = useState("치평중학교 색채 프로젝트 — 리히터의 벽");
  const [showTitle, setShowTitle] = useState(true);
  const [shuffledChips, setShuffledChips] = useState(() => {
    const a = [...allChips];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  });

  // wallSeed 바뀌면 다시 섞기
  useEffect(() => {
    const a = [...allChips];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    setShuffledChips(a);
  }, [wallSeed, allChips.length]);

  const rows = Math.ceil(shuffledChips.length / cols);
  const canvasW = cols * (chipSize + gap) + gap;
  const canvasH = rows * (chipSize + gap) + gap + (showTitle ? 56 : 0);

  // Canvas에 렌더링
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || shuffledChips.length === 0) return;
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvasW, canvasH);

    const offsetY = showTitle ? 52 : 0;

    // 제목
    if (showTitle && title) {
      ctx.fillStyle = "#1A1A1A";
      ctx.font = "bold 18px 'Noto Sans KR', sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(title, canvasW / 2, 26);
    }

    // 색 칩
    shuffledChips.forEach((hex, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gap + col * (chipSize + gap);
      const y = offsetY + gap + row * (chipSize + gap);
      ctx.fillStyle = hex;
      ctx.fillRect(x, y, chipSize, chipSize);

      // 헥스 라벨
      if (showLabel && chipSize >= 48) {
        const r = parseInt(hex.slice(1, 3), 16), g2 = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        const lum = 0.299 * r + 0.587 * g2 + 0.114 * b;
        ctx.fillStyle = lum > 140 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)";
        ctx.font = `${Math.max(8, chipSize * 0.18)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(hex, x + chipSize / 2, y + chipSize / 2);
      }
    });
  }, [shuffledChips, cols, chipSize, gap, showLabel, bgColor, showTitle, title, canvasW, canvasH]);

  // JPG 저장
  const saveJpg = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "치평_리히터의벽.jpg";
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  };

  // PNG 저장 (인쇄용 고화질)
  const savePng = () => {
    // 2배 해상도 캔버스
    const canvas = canvasRef.current;
    if (!canvas) return;
    const hires = document.createElement("canvas");
    hires.width = canvasW * 3;
    hires.height = canvasH * 3;
    const ctx = hires.getContext("2d");
    ctx.scale(3, 3);
    ctx.drawImage(canvas, 0, 0);
    const link = document.createElement("a");
    link.download = "치평_리히터의벽_인쇄용.png";
    link.href = hires.toDataURL("image/png");
    link.click();
  };

  if (allChips.length === 0) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: GRAY }}>색이 모이면 이곳에 벽이 세워집니다.</div>
  );

  return (
    <section>
      {/* 상단 컨트롤 패널 */}
      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700 }}>리히터의 벽 편집</span>
            <span style={{ marginLeft: 10, fontSize: 13, color: GRAY }}>{shuffledChips.length}색 · {cols}열 × {rows}행</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setWallSeed(s => s + 1)} className="harmonyBtn">⤨ 다시 섞기</button>
            <button onClick={saveJpg} style={{ padding: "8px 16px", background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>⬇ JPG 저장</button>
            <button onClick={savePng} style={{ padding: "8px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>🖨 인쇄용 PNG</button>
          </div>
        </div>

        {/* 슬라이더 컨트롤 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: GRAY, marginBottom: 5 }}>가로 열 수: <b style={{ color: INK }}>{cols}열</b></div>
            <input type="range" min={3} max={20} value={cols} onChange={e => setCols(Number(e.target.value))} style={{ width: "100%" }} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: GRAY, marginBottom: 5 }}>칸 크기: <b style={{ color: INK }}>{chipSize}px</b></div>
            <input type="range" min={20} max={120} step={4} value={chipSize} onChange={e => setChipSize(Number(e.target.value))} style={{ width: "100%" }} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: GRAY, marginBottom: 5 }}>칸 간격: <b style={{ color: INK }}>{gap}px</b></div>
            <input type="range" min={0} max={16} value={gap} onChange={e => setGap(Number(e.target.value))} style={{ width: "100%" }} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: GRAY, marginBottom: 5 }}>배경색</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["#FFFFFF", "#1A1A1A", "#F5F0E8", "#E8E4DC"].map(c => (
                <div key={c} onClick={() => setBgColor(c)} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: bgColor === c ? `3px solid #4F46E5` : `1px solid ${LINE}`, cursor: "pointer" }} title={c} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 14, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={showLabel} onChange={e => setShowLabel(e.target.checked)} />
            헥스코드 표시 (칸이 48px 이상일 때)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={showTitle} onChange={e => setShowTitle(e.target.checked)} />
            제목 표시
          </label>
          {showTitle && (
            <input value={title} onChange={e => setTitle(e.target.value)} style={{ flex: 1, minWidth: 200, padding: "8px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} placeholder="전시 제목" />
          )}
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: GRAY, lineHeight: 1.6 }}>
          💡 <b>인쇄 팁</b> — 칸 크기 80~100px, 열 수 10~15로 설정하면 A3 인쇄에 적합해요. "인쇄용 PNG"는 3배 고화질로 저장돼 확대해도 선명합니다.
        </div>
      </div>

      {/* Canvas 미리보기 */}
      <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${LINE}`, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "inline-block", minWidth: "100%" }}>
        <canvas ref={canvasRef} style={{ display: "block", maxWidth: "100%" }} />
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════
// 메인 App
// ════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState("worksheet");
  const [mode, setMode] = useState("custom");
  const [hsvs, setHsvs] = useState(() =>
    ["#F24B78", "#038C7E", "#00A583", "#80C0BF", "#F8CEB8"].map((h) => hexToHsv(h))
  );
  const [activeIdx, setActiveIdx] = useState(BASE_IDX);
  const [paletteName, setPaletteName] = useState("");
  const [name, setName] = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [toast, setToast] = useState("");
  const [palettes, setPalettes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [wallSeed, setWallSeed] = useState(0);
  const [adminMode, setAdminMode] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const wheelRef = useRef(null);
  const dragIdx = useRef(-1);
  const hexes = hsvs.map((c) => hsvToHex(c.h, c.s, c.v));

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };
  const submitCount = getSubmitCount(studentNo, name);
  const canSubmit = submitCount < MAX_SUBMIT;
  const remaining = MAX_SUBMIT - submitCount;

  const posFromHsv = (c, R) => ({ x: R + R * c.s * Math.sin((c.h * Math.PI) / 180), y: R - R * c.s * Math.cos((c.h * Math.PI) / 180) });
  const hsvFromPointer = (clientX, clientY) => {
    const rect = wheelRef.current.getBoundingClientRect();
    const R = rect.width / 2;
    const dx = clientX - rect.left - R, dy = clientY - rect.top - R;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), R);
    const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    return { h, s: dist / R };
  };
  const updateFromDrag = useCallback((clientX, clientY) => {
    const i = dragIdx.current; if (i < 0) return;
    const { h, s } = hsvFromPointer(clientX, clientY);
    setHsvs((prev) => {
      const v = prev[i].v;
      if (mode === "custom") return prev.map((c, k) => (k === i ? { h, s, v } : c));
      const off = HARMONIES[mode].offsets[i];
      const base = { h: (h - (off.dh || 0) + 360) % 360, s: clamp(s - (off.ds || 0), 0.05, 1), v: clamp(v - (off.dv || 0), 0.15, 1) };
      return applyHarmony(mode, base);
    });
  }, [mode]);

  useEffect(() => {
    const move = (e) => { if (dragIdx.current < 0) return; e.preventDefault(); const p = e.touches ? e.touches[0] : e; updateFromDrag(p.clientX, p.clientY); };
    const up = () => { dragIdx.current = -1; };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    window.addEventListener("touchmove", move, { passive: false }); window.addEventListener("touchend", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("touchmove", move); window.removeEventListener("touchend", up); };
  }, [updateFromDrag]);

  const changeMode = (m) => { setMode(m); if (m !== "custom") setHsvs((prev) => applyHarmony(m, prev[BASE_IDX])); };
  const randomize = () => {
    const base = { h: Math.random() * 360, s: 0.5 + Math.random() * 0.5, v: 0.55 + Math.random() * 0.45 };
    if (mode === "custom") setHsvs(Array.from({ length: 5 }, () => ({ h: Math.random() * 360, s: 0.4 + Math.random() * 0.6, v: 0.5 + Math.random() * 0.5 })));
    else setHsvs(applyHarmony(mode, base));
  };
  const setHexAt = (i, raw) => {
    const hsv = hexToHsv(raw); if (!hsv) return;
    setHsvs((prev) => {
      if (mode === "custom") return prev.map((c, k) => (k === i ? hsv : c));
      const off = HARMONIES[mode].offsets[i];
      const base = { h: (hsv.h - (off.dh || 0) + 360) % 360, s: clamp(hsv.s - (off.ds || 0), 0.05, 1), v: clamp(hsv.v - (off.dv || 0), 0.15, 1) };
      return applyHarmony(mode, base);
    });
  };
  const copyText = async (text, label) => {
    try { await navigator.clipboard.writeText(text); } catch { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (e) { } t.remove(); }
    showToast(`${label || text} 복사됨`);
  };
  const exportJSON = () => {
    const data = { name: paletteName.trim() || "나의 팔레트", author: name.trim(), studentNo: studentNo.trim(), harmony: HARMONIES[mode].label, colors: hexes, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${(paletteName.trim() || "palette").replace(/\s+/g, "_")}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    showToast("JSON 파일로 저장했어요");
  };
  const loadPalettes = useCallback(async () => {
    setLoading(true);
    try {
      const { supabase } = await import('./supabase.js');
      const { data, error } = await supabase.from('palettes').select('*').order('created_at', { ascending: false });
      setPalettes(error ? [] : data.map(p => ({ ...p, key: p.id })));
    } catch (e) { setPalettes([]); }
    setLoading(false);
  }, []);
  useEffect(() => { loadPalettes(); }, [loadPalettes]);

  const submit = async () => {
    if (!studentNo.trim()) { showToast("학번을 입력해 주세요 (예: 1100)"); return; }
    if (!name.trim()) { showToast("이름을 입력해 주세요"); return; }
    if (!paletteName.trim()) { showToast("팔레트 이름을 지어 주세요"); return; }
    if (!canSubmit) { showToast(`제출 횟수(${MAX_SUBMIT}회)를 모두 사용했어요`); return; }
    setSubmitting(true);
    try {
      const { supabase } = await import('./supabase.js');
      const { error } = await supabase.from('palettes').insert({ name: name.trim(), klass: studentNo.trim(), title: paletteName.trim(), harmony: HARMONIES[mode].label, colors: hexes });
      if (error) throw error;
      incSubmitCount(studentNo.trim(), name.trim());
      showToast(`제출 완료! (남은 횟수: ${remaining - 1}회) 🎨`);
      setPaletteName("");
      await loadPalettes();
      setTab("gallery");
    } catch (e) { showToast("저장에 실패했어요. 다시 시도해 주세요"); }
    setSubmitting(false);
  };
  const adminLogin = () => {
    if (adminInput === ADMIN_PW) { setAdminMode(true); setShowAdminLogin(false); setAdminInput(""); showToast("관리자 모드 활성화 🔓"); }
    else showToast("비밀번호가 틀렸어요");
  };
  const deletePalette = async (id) => {
    if (!adminMode) return; setDeletingId(id);
    try {
      const { supabase } = await import('./supabase.js');
      const { error } = await supabase.from('palettes').delete().eq('id', id);
      if (error) throw error;
      showToast("삭제했어요"); await loadPalettes();
    } catch (e) { showToast("삭제 실패"); }
    setDeletingId(null);
  };

  const allChips = palettes.flatMap((p) => p.colors || []);
  const wallChips = shuffleArr(allChips);
  void wallSeed;

  const R = 150;
  const tabBtn = (id, label) => (
    <button key={id} onClick={() => setTab(id)} className="tabBtn"
      style={{ color: tab === id ? INK : GRAY, borderBottom: tab === id ? `2px solid ${INK}` : "2px solid transparent", fontWeight: tab === id ? 700 : 400 }}>
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8", color: INK, fontFamily: "'Noto Sans KR','Apple SD Gothic Neo',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet" />
      <style>{`
        .tabBtn { background:none; border:none; cursor:pointer; padding:10px 4px; margin-right:20px; font-size:15px; font-family:inherit; letter-spacing:0.02em; }
        .layout { display:grid; grid-template-columns:360px 1fr; gap:36px; }
        .cols { display:flex; height:480px; border-radius:10px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.12); }
        .harmonyBtn { border:1px solid ${LINE}; background:#fff; border-radius:8px; padding:8px 12px; font-size:13px; cursor:pointer; font-family:inherit; }
        .col:hover .copyIc { opacity:1; }
        input.field { padding:11px 13px; border:1px solid ${LINE}; border-radius:8px; font-size:14px; font-family:inherit; background:#fff; }
        .deleteBtn { background:#FEE2E2; border:none; border-radius:6px; padding:6px 12px; font-size:12px; color:#DC2626; cursor:pointer; font-family:inherit; font-weight:700; }
        .deleteBtn:hover { background:#FECACA; }
        @media (max-width:860px) { .layout { grid-template-columns:1fr; } .cols { height:280px; } }
      `}</style>

      <header style={{ maxWidth: 1080, margin: "0 auto", padding: "36px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: "0.22em", color: GRAY, marginBottom: 8 }}>치평중학교 미술 수업 · 색채 프로젝트</div>
            <h1 style={{ fontSize: "clamp(24px,4vw,34px)", fontWeight: 900, margin: 0, lineHeight: 1.3 }}>치평 색채 연구소</h1>
          </div>
          <div>
            {adminMode ? (
              <button onClick={() => setAdminMode(false)} style={{ background: "#FEE2E2", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#DC2626", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>🔓 관리자 ON — 종료</button>
            ) : (
              <button onClick={() => setShowAdminLogin(true)} style={{ background: "none", border: `1px solid ${LINE}`, borderRadius: 8, padding: "8px 14px", fontSize: 12, color: GRAY, cursor: "pointer", fontFamily: "inherit" }}>🔒 관리자</button>
            )}
          </div>
        </div>

        {showAdminLogin && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 300, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>🔒 관리자 로그인</div>
              <input type="password" value={adminInput} onChange={e => setAdminInput(e.target.value)} onKeyDown={e => e.key === "Enter" && adminLogin()} placeholder="비밀번호 입력" autoFocus style={{ width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={adminLogin} style={{ flex: 1, padding: 10, background: INK, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>확인</button>
                <button onClick={() => { setShowAdminLogin(false); setAdminInput(""); }} style={{ flex: 1, padding: 10, background: "#F3F3F0", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>취소</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: GRAY, letterSpacing: "0.06em" }}>참고 도구</span>
          <a href="https://colorion.co/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: INK, textDecoration: "none", border: `1px solid ${LINE}`, borderRadius: 999, padding: "6px 14px", background: "#fff" }}>🎨 Colorion ↗</a>
          <a href="https://color.adobe.com/kr/create/color-wheel" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: INK, textDecoration: "none", border: `1px solid ${LINE}`, borderRadius: 999, padding: "6px 14px", background: "#fff" }}>🌈 Adobe Color ↗</a>
        </div>

        <nav style={{ borderBottom: `1px solid ${LINE}`, marginTop: 20 }}>
          {tabBtn("worksheet", "① 색채 이론")}
          {tabBtn("learn", "② 색채 실습")}
          {tabBtn("make", "③ 팔레트 만들기")}
          {tabBtn("gallery", `④ 치평 갤러리${palettes.length ? ` (${palettes.length})` : ""}`)}
          {tabBtn("wall", "⑤ 리히터의 벽")}
        </nav>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 80px" }}>

        {/* ① 색채 이론 워크시트 */}
        {tab === "worksheet" && <WorksheetTab />}

        {/* ② 색채 실습 */}
        {tab === "learn" && <LearnTab />}

        {/* ② 팔레트 만들기 */}
        {tab === "make" && (
          <section className="layout">
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <b style={{ fontSize: 15 }}>🎨 색상환</b>
                <button onClick={randomize} className="harmonyBtn" style={{ fontWeight: 700 }}>⤨ 무작위 생성</button>
              </div>
              <div ref={wheelRef} style={{ position: "relative", width: R * 2, height: R * 2, maxWidth: "100%", borderRadius: "50%", margin: "0 auto", touchAction: "none", background: `radial-gradient(circle closest-side,#ffffff 0%,rgba(255,255,255,0) 78%),conic-gradient(from 0deg,#FF0000,#FFFF00 60deg,#00FF00 120deg,#00FFFF 180deg,#0000FF 240deg,#FF00FF 300deg,#FF0000 360deg)`, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }}
                onPointerDown={(e) => { dragIdx.current = activeIdx; updateFromDrag(e.clientX, e.clientY); }}>
                {hsvs.map((c, i) => {
                  const p = posFromHsv(c, R);
                  const isActive = i === activeIdx, isBase = i === BASE_IDX && mode !== "custom";
                  return <div key={i} onPointerDown={(e) => { e.stopPropagation(); dragIdx.current = i; setActiveIdx(i); }}
                    style={{ position: "absolute", left: `${(p.x / (R * 2)) * 100}%`, top: `${(p.y / (R * 2)) * 100}%`, transform: "translate(-50%,-50%)", width: isBase ? 34 : 26, height: isBase ? 34 : 26, borderRadius: "50%", background: hexes[i], border: `${isActive ? 4 : 3}px solid #fff`, boxShadow: isActive ? "0 0 0 2px #1A1A1A,0 2px 6px rgba(0,0,0,0.3)" : "0 1px 4px rgba(0,0,0,0.35)", cursor: "grab", touchAction: "none" }} />;
                })}
              </div>
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 12, color: GRAY, marginBottom: 6 }}>{activeIdx + 1}번 색 밝기 <b style={{ color: INK, fontFamily: "monospace" }}>{hexes[activeIdx]}</b></div>
                <input type="range" min="15" max="100" value={Math.round(hsvs[activeIdx].v * 100)}
                  onChange={(e) => { const v = Number(e.target.value) / 100; setHsvs((prev) => { if (mode === "custom") return prev.map((c, k) => (k === activeIdx ? { ...c, v } : c)); const off = HARMONIES[mode].offsets[activeIdx]; const base = { ...prev[BASE_IDX], v: clamp(v - (off.dv || 0), 0.15, 1) }; return applyHarmony(mode, base); }); }}
                  style={{ width: "100%", accentColor: hexes[activeIdx] }} />
              </div>
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, marginBottom: 8 }}><b>색상 조화:</b> <span style={{ color: GRAY }}>{HARMONIES[mode].label}</span></div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Object.entries(HARMONIES).map(([k, hInfo]) => (
                    <button key={k} onClick={() => changeMode(k)} className="harmonyBtn" style={{ borderColor: mode === k ? INK : LINE, fontWeight: mode === k ? 700 : 400, background: mode === k ? "#F3F3F0" : "#fff" }}>{hInfo.label}</button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="cols">
                {hexes.map((hex, i) => (
                  <div key={i} className="col" onClick={() => setActiveIdx(i)}
                    style={{ flex: activeIdx === i ? 1.25 : 1, background: hex, position: "relative", cursor: "pointer", transition: "flex .25s", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div style={{ padding: "0 0 18px 14px", color: textColorOn(hex), display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700 }}>{hex}</span>
                      <button className="copyIc" onClick={(e) => { e.stopPropagation(); copyText(hex); }} style={{ opacity: 0.55, background: "none", border: `1.5px dashed ${textColorOn(hex)}`, color: textColorOn(hex), borderRadius: 5, width: 24, height: 24, cursor: "pointer", fontSize: 12, lineHeight: 1, transition: "opacity .15s" }}>⧉</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 18 }}>
                <div style={{ display: "flex", width: 150, height: 40, borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}>{hexes.map((h, i) => <div key={i} style={{ flex: 1, background: h }} />)}</div>
                <button onClick={() => copyText(hexes.join(", "), "팔레트 전체")} className="harmonyBtn">⧉ 전체 복사</button>
                <button onClick={exportJSON} className="harmonyBtn" style={{ fontWeight: 700 }}>⬇ Export JSON</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 16 }}>
                <input className="field" value={studentNo} onChange={(e) => setStudentNo(e.target.value)} placeholder="학번 (예: 1100)" maxLength={10} />
                <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" />
                <input className="field" value={paletteName} onChange={(e) => setPaletteName(e.target.value)} placeholder="팔레트 이름 (예: 여름 쨍쨍)" style={{ gridColumn: "1 / -1" }} />
              </div>
              {(studentNo.trim() && name.trim()) && (
                <div style={{ marginTop: 10, fontSize: 13, color: canSubmit ? "#059669" : "#DC2626" }}>
                  {canSubmit ? `✓ 제출 가능 — 남은 횟수: ${remaining}/${MAX_SUBMIT}회` : `✗ 제출 횟수(${MAX_SUBMIT}회)를 모두 사용했어요. 선생님께 문의하세요.`}
                </div>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <button onClick={submit} disabled={submitting || !canSubmit}
                  style={{ padding: "13px 30px", fontSize: 15, fontWeight: 700, background: canSubmit ? "#4F46E5" : "#D1D5DB", color: "#fff", border: "none", borderRadius: 999, cursor: (submitting || !canSubmit) ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1, fontFamily: "inherit" }}>
                  {submitting ? "제출 중…" : canSubmit ? "내 컬러팔레트 제출" : "제출 불가 (횟수 초과)"}
                </button>
              </div>
              <details style={{ marginTop: 18 }}>
                <summary style={{ fontSize: 13, color: GRAY, cursor: "pointer" }}>헥스코드로 직접 입력하기</summary>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {hexes.map((h, i) => <input key={i} defaultValue={h} onBlur={(e) => setHexAt(i, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setHexAt(i, e.target.value); }} style={{ fontFamily: "monospace", fontSize: 13, width: 92, padding: "8px 10px", border: `1px solid ${LINE}`, borderRadius: 6 }} />)}
                </div>
              </details>
            </div>
          </section>
        )}

        {/* ③ 치평 갤러리 */}
        {tab === "gallery" && (
          <section>
            {adminMode && <div style={{ marginBottom: 16, padding: "10px 14px", background: "#FEF3C7", borderRadius: 8, fontSize: 13, color: "#92400E" }}>🔓 관리자 모드 — 각 카드의 삭제 버튼으로 팔레트를 삭제할 수 있어요.</div>}
            {loading ? <p style={{ color: GRAY }}>갤러리를 여는 중…</p>
              : palettes.length === 0 ? <div style={{ textAlign: "center", padding: "60px 0", color: GRAY }}>아직 전시된 팔레트가 없어요.<br />첫 번째 작가가 되어 보세요!</div>
              : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 18 }}>
                  {palettes.map((p) => (
                    <article key={p.key} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                      <div style={{ display: "flex", height: 84 }}>{(p.colors || []).map((c, i) => <div key={i} style={{ flex: 1, background: c }} title={c} />)}</div>
                      <div style={{ padding: "13px 15px" }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{p.title}</div>
                        <div style={{ fontSize: 12, color: GRAY, marginTop: 6 }}>{p.klass ? `학번 ${p.klass} · ` : ""}{p.name}{p.harmony ? ` · ${p.harmony}` : ""}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                          <button className="harmonyBtn" style={{ fontSize: 12 }} onClick={() => copyText((p.colors || []).join(", "), `${p.title} 팔레트`)}>⧉ 복사</button>
                          <button className="harmonyBtn" style={{ fontSize: 12 }} onClick={() => { const blob = new Blob([JSON.stringify({ name: p.title, author: p.name, studentNo: p.klass, harmony: p.harmony, colors: p.colors }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${(p.title || "palette").replace(/\s+/g, "_")}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); showToast("JSON 저장 완료"); }}>⬇ JSON</button>
                          {adminMode && <button className="deleteBtn" onClick={() => deletePalette(p.id || p.key)} disabled={deletingId === (p.id || p.key)}>{deletingId === (p.id || p.key) ? "삭제 중…" : "🗑 삭제"}</button>}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>}
          </section>
        )}

        {/* ④ 리히터의 벽 */}
        {tab === "wall" && (
          <WallTab allChips={allChips} wallSeed={wallSeed} setWallSeed={setWallSeed} />
        )}
      </main>

      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: INK, color: "#fff", padding: "12px 22px", borderRadius: 8, fontSize: 14, boxShadow: "0 4px 16px rgba(0,0,0,0.25)", zIndex: 50 }}>
          {toast}
        </div>
      )}
    </div>
  );
}