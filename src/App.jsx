import { useState, useRef } from "react";

// ─── Fonts ────────────────────────────────────────────────────────────────────
const fl = document.createElement("link");
fl.rel = "stylesheet";
fl.href = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap";
document.head.appendChild(fl);

// ─── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  bg:"#f7f7f5", surface:"#ffffff", border:"#e4e4e0", text:"#18181a",
  sub:"#6b6b6b", mute:"#a8a8a0", accent:"#1a56db",
  accentBg:"#eff4ff", accentBorder:"#c3d4fb", danger:"#dc2626",
  mono:"'DM Mono',monospace", sans:"'Outfit',sans-serif",
};

// ─── Strings ──────────────────────────────────────────────────────────────────
const T = {
  subtitle: "Your learning state, recorded",
  tabs: ["Now","Record"],
  emotionQ: "What is your current state?",
  emotionSub: "Multiple selections allowed",
  emotions: {
    frustrated: { label:"Stuck / Frustrated",  color:"#b45309", bg:"#fef3c7", border:"#fcd34d" },
    anxious:    { label:"Anxious / Tense",      color:"#dc2626", bg:"#fee2e2", border:"#fca5a5" },
    confused:   { label:"Confused / Wondering", color:"#7c3aed", bg:"#f5f3ff", border:"#c4b5fd" },
    curious:    { label:"Curious / Exploring",  color:"#0369a1", bg:"#e0f2fe", border:"#7dd3fc" },
    proud:      { label:"Got It / Proud",        color:"#166534", bg:"#dcfce7", border:"#86efac" },
  },
  emoji: { frustrated:"😤", anxious:"😰", confused:"🤔", curious:"🔍", proud:"✨" },
  obs: {
    frustrated: "Consistent with high cognitive load processing.",
    anxious:    "Physiological response to uncertainty detected.",
    confused:   "Concept-bridging process in progress.",
    curious:    "Exploratory cognitive activity active.",
    proud:      "Concept connection signal detected.",
  },
  hrvAsk:   "Camera can measure your heart rate for comparison.",
  hrvYes:   "Measure (optional)",
  hrvNo:    "Skip",
  hrvScan:  "Measuring — keep face in frame",
  hrvErr:   "Camera unavailable — body channel skipped",
  hrvSrc:   "rPPG · camera",
  textQ:    "Describe what is not working",
  textSub:  "Error messages, concepts that won't click, unexpected results — more specific = more accurate",
  ph:       "Examples:\n- My model accuracy keeps coming out low.\n- I can't see any pattern in the climate data.\n- Why does adding more data still give wrong predictions?",
  record:   "Record",
  analyzing:"Analyzing",
  clear:    "Clear",
  textCh:   "Text Channel",
  cogLoad:  "Cognitive Load Signal",
  detected: "Detected State",
  states: { stressed:"High difficulty zone", struggling:"Repeated attempt pattern", curious:"Exploratory activity", positive:"Concept connected", neutral:"Analyzing" },
  mAI:"Claude", mKW:"Keyword",
  bodyCh:   "Body Channel",
  bpmRange: (b) => b>=90 ? "Tense range" : b>=65 ? "Stable range" : "Relaxed range",
  bridgeDiag:"Problem diagnosis", bridgeNext:"Try this now",
  compLabel:"State Comparison", compText:"Text state", compBody:"Body signal", compRel:"Relationship",
  bpmH:"HR up — Tense", bpmM:"HR stable — Normal", bpmL:"HR down — Relaxed",
  relMatch:"Both channels point in the same direction",
  relDiv:  "Two channels are sending different signals",
  relPart: "Signals from both channels are mixed",
  relObs: {
    match:      "Your reported state and physiological signal are consistent.",
    divergence: "This pattern appears when emotional expression doesn't match physiological arousal.",
    partial:    "Mixed signals — one possible indicator of high cognitive load.",
  },
  relQ:    "What does this tell you?",
  crisis:  "If things feel too heavy right now, reach out:", crisisLink:"988 Lifeline",
  histEmpty:"No records yet", histSub:"Start your first record in the Now tab.",
  histBridge:"Concept connection:",
  pAnalysis: (t) => `You are a Learning Sciences expert. Analyze the student input and return ONLY valid JSON — no markdown, no preamble.
Student input: "${t}"
Return exactly:
{"emotionState":"stressed|struggling|curious|positive|neutral","stressScore":0,"curiosityScore":0,"effortScore":0,"positiveScore":0,"cogLoad":0,"insight":"one observational sentence — no judgment","method":"claude"}
Rules: stressed=high load unsolved / struggling=repeated attempts / curious=exploratory / positive=concept connected / neutral=no signal. cogLoad 0-100.`,
  pBridge: (t) => `You are a Learning Sciences expert. If the student input connects to a science or ML concept, return ONLY valid JSON — no markdown.
Student input: "${t}"
Domain hints: Climate="can't see pattern"→time scale mismatch,STL. ML="accuracy low"→confusion matrix,bias-variance. Bio="PCR failed"→primer,Tm. Physics="simulation wrong"→boundary conditions,dt.
If relevant: {"relevant":true,"domain":"name","concept":"core concept","icon":"emoji","diagnosis":"2 sentences","explanation":"2-3 sentences, **bold** ok","nextStep":"one action"}
If not: {"relevant":false}`,
};

// ─── Keyword fallback ─────────────────────────────────────────────────────────
const SW = ["frustrated","confused","stuck","lost","failed","error","wrong","can't","cannot","impossible","difficult","unclear","don't understand","can't figure","not working","doesn't work","keeps failing"];
const CW = ["why","how","wonder","curious","explore","discover","what if","how does","what causes"];
const EW = ["tried","attempt","again","retry","kept","working on","trying","multiple times","keep trying"];
const PW = ["got it","understand","works","solved","figured","makes sense","clicked","finally","now I see"];
const NW = ["don't understand","can't figure","doesn't make sense","not working","doesn't work"];

function localAnalyze(text) {
  const lo = text.toLowerCase();
  const neg = NW.filter(p=>lo.includes(p)).length;
  const s = SW.filter(w=>lo.includes(w)).length + neg;
  const cu = CW.filter(w=>lo.includes(w)).length;
  const e = EW.filter(w=>lo.includes(w)).length;
  const p = Math.max(0, PW.filter(w=>lo.includes(w)).length - neg);
  const tot = s+cu+e+p||1;
  const cog = Math.min(100, Math.round(((s*3+e)/(tot+1))*70 + Math.min(20,text.length/6)));
  const es = s>=2?"stressed":s===1?"struggling":e>0?"struggling":cu>0?"curious":p>0?"positive":"neutral";
  return { stressScore:s, curiosityScore:cu, effortScore:e, positiveScore:p, cogLoad:cog, emotionState:es, method:"keyword" };
}

const CRISIS = ["kill myself","want to die","self harm","disappear","can't go on","end it all","no point living"];
const isCrisis = (t) => CRISIS.some(w=>t.toLowerCase().includes(w));

// ─── API — all calls through /api/analyze proxy ───────────────────────────────
async function callAPI(messages) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch("/api/analyze", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ messages, max_tokens:1000 }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    return await res.json();
  } catch(e) {
    clearTimeout(tid);
    throw e;
  }
}

async function aiAnalyze(text) {
  const d = await callAPI([{ role:"user", content:T.pAnalysis(text) }]);
  const raw = d.content?.map(b=>b.text||"").join("").trim();
  return JSON.parse(raw.replace(/```json|```/g,"").trim());
}

async function aiBridge(text) {
  const d = await callAPI([{ role:"user", content:T.pBridge(text) }]);
  const raw = d.content?.map(b=>b.text||"").join("").trim();
  const p = JSON.parse(raw.replace(/```json|```/g,"").trim());
  return p.relevant===false ? null : p;
}

// ─── Comparison ───────────────────────────────────────────────────────────────
function relate(es, bpm) {
  const hi = ["stressed","struggling"], ok = ["positive"], ex = ["curious"], nu = ["neutral"];
  const tense = bpm>=90, relax = bpm<65, stable = !tense&&!relax;
  if (hi.includes(es) && tense)              return "match";
  if (ok.includes(es) && (relax||stable))    return "match";
  if (ex.includes(es) && stable)             return "match";
  if ((nu.includes(es)||ok.includes(es)) && tense) return "divergence";
  if (hi.includes(es) && relax)              return "divergence";
  return "partial";
}

const cogCol = (v) => v>70?"#b45309":v>40?"#d97706":"#059669";
const bpmCol = (b) => b>=90?"#dc2626":b>=65?"#059669":"#3b82f6";

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  root: { fontFamily:C.sans, background:C.bg, minHeight:"100vh", color:C.text },
  hdr: { background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 },
  logoT: { fontFamily:C.mono, fontSize:17, fontWeight:500, letterSpacing:"-0.02em" },
  logoS: { fontSize:11, color:C.mute, marginTop:2 },
  tabs: { display:"flex", borderBottom:`1px solid ${C.border}`, background:C.surface, padding:"0 20px" },
  tab: (a) => ({ fontFamily:C.sans, fontSize:13, fontWeight:a?600:400, color:a?C.text:C.mute, padding:"12px 0", marginRight:28, border:"none", background:"none", cursor:"pointer", borderBottom:`2px solid ${a?C.text:"transparent"}`, transition:"all .15s" }),
  body: { maxWidth:600, margin:"0 auto", padding:"20px 16px 60px" },
  card: { background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:18, marginBottom:10 },
  lbl: { fontFamily:C.mono, fontSize:10, fontWeight:500, color:C.mute, letterSpacing:".08em", textTransform:"uppercase", marginBottom:10 },
  ttl: { fontSize:15, fontWeight:600, marginBottom:3 },
  sub: { fontSize:12, color:C.sub, marginBottom:14, lineHeight:1.5 },
  grid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 },
  eBtn: (s,cfg) => ({ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", border:`1.5px solid ${s?cfg.border:C.border}`, borderRadius:10, background:s?cfg.bg:C.surface, cursor:"pointer", transition:"all .12s", textAlign:"left" }),
  eLbl: (s,cfg) => ({ fontSize:12, fontWeight:s?600:400, color:s?cfg.color:C.sub, lineHeight:1.3 }),
  obsCard: { background:C.accentBg, border:`1px solid ${C.accentBorder}`, borderRadius:8, padding:"10px 14px", marginTop:10, fontSize:12, color:C.accent, lineHeight:1.6 },
  ta: { width:"100%", minHeight:120, padding:"12px 14px", fontFamily:C.sans, fontSize:13, color:C.text, background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, resize:"vertical", outline:"none", lineHeight:1.7, boxSizing:"border-box" },
  btn: { width:"100%", padding:12, background:C.text, color:"#fff", border:"none", borderRadius:10, fontFamily:C.sans, fontSize:13, fontWeight:600, cursor:"pointer", letterSpacing:".01em" },
  sec: { padding:"8px 16px", background:"none", color:C.sub, border:`1px solid ${C.border}`, borderRadius:8, fontFamily:C.sans, fontSize:12, cursor:"pointer" },
  chLbl: (col) => ({ fontFamily:C.mono, fontSize:9, fontWeight:500, letterSpacing:".1em", textTransform:"uppercase", color:col||C.mute, marginBottom:6 }),
  row: { display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 },
  dl: { fontSize:11, color:C.sub },
  dv: { fontFamily:C.mono, fontSize:11, fontWeight:500, color:C.text },
  bar: { height:3, background:C.border, borderRadius:99, overflow:"hidden", marginTop:8 },
  fill: (pct,col) => ({ height:"100%", width:`${pct}%`, background:col||C.text, borderRadius:99, transition:"width .8s ease" }),
  bridge: { background:"#0f172a", border:"1px solid #1e293b", borderRadius:12, padding:"16px 18px", marginBottom:10 },
  crisisCard: { background:"#fff5f5", border:"1px solid #fca5a5", borderRadius:10, padding:"12px 16px", marginBottom:10 },
};

const css = document.createElement("style");
css.textContent = `
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes fade { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
  .fade { animation:fade .2s ease; }
  * { box-sizing:border-box; }
  button { font-family:'Outfit',sans-serif; }
  textarea:focus { border-color:#18181a!important; }
`;
document.head.appendChild(css);

// ─── Components ───────────────────────────────────────────────────────────────
function Spin() {
  return <span style={{ display:"inline-block", width:12, height:12, border:`2px solid ${C.border}`, borderTopColor:C.text, borderRadius:"50%", animation:"spin .7s linear infinite", flexShrink:0 }}/>;
}

function EmotionBtns({ sel, toggle }) {
  const keys = ["frustrated","anxious","confused","curious","proud"];
  return (
    <div>
      <div style={S.ttl}>{T.emotionQ}</div>
      <div style={{...S.sub, marginBottom:12}}>{T.emotionSub}</div>
      <div style={S.grid2}>
        {keys.map(k => {
          const cfg = T.emotions[k], s = sel.includes(k);
          return (
            <button key={k} onClick={()=>toggle(k)} style={S.eBtn(s,cfg)}>
              <span style={{fontSize:20,lineHeight:1,flexShrink:0}}>{T.emoji[k]}</span>
              <span style={S.eLbl(s,cfg)}>{cfg.label}</span>
            </button>
          );
        })}
        {keys.length%2!==0 && <div/>}
      </div>
    </div>
  );
}

function HRV({ onBpm }) {
  const [st, setSt] = useState("ask");
  const [bpm, setBpm] = useState(null);
  const vr=useRef(), cr=useRef(), sr=useRef(), rr=useRef(), buf=useRef([]);
  const SR=30, BUF=150;

  function extractBpm(b) {
    const n=b.length, m=b.reduce((a,v)=>a+v,0)/n, x=b.map(v=>v-m);
    const re=new Array(n).fill(0), im=new Array(n).fill(0);
    for(let k=0;k<n;k++) for(let t=0;t<n;t++){const a=(2*Math.PI*k*t)/n;re[k]+=x[t]*Math.cos(a);im[k]+=x[t]*Math.sin(a);}
    const mag=re.map((r,i)=>Math.sqrt(r*r+im[i]*im[i]));
    let mx=0,bk=0;
    for(let k=1;k<n/2;k++){const hz=(k*SR)/n;if(hz>=.67&&hz<=3&&mag[k]>mx){mx=mag[k];bk=k;}}
    return Math.round((bk*SR)/n*60);
  }

  const start = async () => {
    setSt("scan");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:160,height:120,frameRate:{ideal:30}}});
      sr.current=stream; vr.current.srcObject=stream; await vr.current.play();
      buf.current=[]; let fc=0;
      const ctx=cr.current.getContext("2d");
      const loop=()=>{
        if(!vr.current||vr.current.paused)return;
        ctx.drawImage(vr.current,0,0,80,60);
        const px=ctx.getImageData(0,0,80,60).data;
        let g=0; for(let i=0;i<px.length;i+=4)g+=px[i+1];
        buf.current.push(g/(px.length/4));
        if(buf.current.length>BUF)buf.current.shift();
        fc++;
        if(fc%(SR*5)===0&&buf.current.length>=BUF){
          const bv=extractBpm(buf.current);
          if(bv>=40&&bv<=180){setBpm(bv);setSt("done");onBpm(bv);sr.current?.getTracks().forEach(t=>t.stop());cancelAnimationFrame(rr.current);return;}
        }
        rr.current=requestAnimationFrame(loop);
      };
      rr.current=requestAnimationFrame(loop);
      setTimeout(()=>{if(st!=="done"){setSt("err");sr.current?.getTracks().forEach(t=>t.stop());cancelAnimationFrame(rr.current);}},35000);
    } catch { setSt("err"); }
  };

  if(st==="skip")return null;
  const hidden=<><video ref={vr} style={{display:"none"}} playsInline muted/><canvas ref={cr} width={80} height={60} style={{display:"none"}}/></>;
  const row={display:"flex",alignItems:"center",gap:10,marginTop:10,padding:"8px 2px",borderTop:`1px solid ${C.border}`};

  if(st==="ask")return(
    <div style={row}>{hidden}
      <span style={{fontSize:12,color:C.sub,flex:1}}>{T.hrvAsk}</span>
      <button onClick={start} style={{...S.sec,fontSize:11,padding:"5px 12px"}}>{T.hrvYes}</button>
      <button onClick={()=>setSt("skip")} style={{...S.sec,fontSize:11,padding:"5px 12px",border:"none",color:C.mute}}>{T.hrvNo}</button>
    </div>
  );
  if(st==="scan")return <div style={row}>{hidden}<Spin/><span style={{fontSize:12,color:C.sub}}>{T.hrvScan}</span></div>;
  if(st==="err") return <div style={row}>{hidden}<span style={{fontSize:12,color:C.danger}}>{T.hrvErr}</span></div>;
  if(st==="done"&&bpm)return(
    <div style={row}>{hidden}
      <span style={{fontSize:12,color:C.sub,flex:1}}>{T.bodyCh}</span>
      <span style={{fontFamily:C.mono,fontSize:14,fontWeight:500,color:bpmCol(bpm)}}>{bpm}</span>
      <span style={{fontSize:11,color:C.mute}}>BPM — {T.bpmRange(bpm)}</span>
    </div>
  );
  return null;
}

function CompCard({ result, bpm, selEmotions }) {
  if(!bpm||!result)return null;
  const rel  = relate(result.emotionState, bpm);
  const bstr = bpm>=90?T.bpmH:bpm>=65?T.bpmM:T.bpmL;
  const tlbl = selEmotions.length>0 ? selEmotions.map(k=>T.emotions[k]?.label||k).join(" / ") : T.states[result.emotionState]||result.emotionState;
  const rtxt = rel==="match"?T.relMatch:rel==="divergence"?T.relDiv:T.relPart;
  const rcol = rel==="divergence"?C.accent:C.text;
  const bord = rel==="divergence"?`1.5px solid ${C.accentBorder}`:`1px solid ${C.border}`;
  return(
    <div style={{background:C.surface,border:bord,borderRadius:12,padding:"16px 18px",marginBottom:10}}>
      <div style={S.chLbl()}>{T.compLabel}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div style={{background:C.bg,borderRadius:8,padding:"10px 12px"}}>
          <div style={{fontFamily:C.mono,fontSize:9,color:C.mute,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>{T.compText}</div>
          <div style={{fontSize:12,fontWeight:500,lineHeight:1.4}}>{tlbl}</div>
        </div>
        <div style={{background:C.bg,borderRadius:8,padding:"10px 12px"}}>
          <div style={{fontFamily:C.mono,fontSize:9,color:C.mute,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>{T.compBody}</div>
          <div style={{fontSize:12,fontWeight:500,color:bpmCol(bpm),lineHeight:1.4}}>{bstr}</div>
          <div style={{fontFamily:C.mono,fontSize:9,color:C.mute,marginTop:4}}>{T.hrvSrc}</div>
        </div>
      </div>
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
        <div style={{fontFamily:C.mono,fontSize:9,color:C.mute,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>{T.compRel}</div>
        <div style={{fontSize:13,fontWeight:500,color:rcol,marginBottom:6}}>{rtxt}</div>
        <div style={{fontSize:11,color:C.sub,lineHeight:1.6,marginBottom:6}}>{T.relObs[rel]}</div>
        <div style={{fontSize:11,color:C.mute,fontStyle:"italic"}}>{T.relQ}</div>
      </div>
    </div>
  );
}

function Results({ result, bridge, bridgeLoading, bpm, selEmotions }) {
  const es = result?.emotionState||"neutral";
  return(
    <div style={{marginTop:10}}>
      {bridgeLoading&&<div style={{...S.card,display:"flex",alignItems:"center",gap:10}}><Spin/><span style={{fontSize:12,color:C.sub}}>Finding concept connections...</span></div>}
      {!bridgeLoading&&bridge&&(
        <div style={S.bridge}>
          <div style={S.chLbl("#64748b")}>Science Bridge</div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <span style={{fontSize:20}}>{bridge.icon}</span>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"#f8fafc"}}>{bridge.domain}</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>{bridge.concept}</div>
            </div>
          </div>
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:500,textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>{T.bridgeDiag}</div>
          <div style={{fontSize:12,color:"#cbd5e1",lineHeight:1.7,marginBottom:12}}>{bridge.diagnosis}</div>
          <div style={{fontSize:12,color:"#e2e8f0",lineHeight:1.7,marginBottom:12}} dangerouslySetInnerHTML={{__html:bridge.explanation.replace(/\*\*(.*?)\*\*/g,'<strong style="color:#fff">$1</strong>')}}/>
          {bridge.nextStep&&<div style={{borderTop:"1px solid #1e293b",paddingTop:10}}>
            <div style={{fontSize:11,color:"#64748b",fontWeight:500,textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>{T.bridgeNext}</div>
            <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.6}}>{bridge.nextStep}</div>
          </div>}
        </div>
      )}
      <CompCard result={result} bpm={bpm} selEmotions={selEmotions}/>
      <div style={S.card}>
        <div style={S.chLbl()}>{T.textCh}</div>
        <div style={S.row}><span style={S.dl}>{T.detected}</span><span style={S.dv}>{T.states[es]}</span></div>
        <div style={S.row}>
          <span style={S.dl}>{T.cogLoad}</span>
          <span style={{...S.dv,color:cogCol(result?.cogLoad||0)}}>{result?.cogLoad??"—"}%</span>
        </div>
        <div style={S.bar}><div style={S.fill(result?.cogLoad||0,cogCol(result?.cogLoad||0))}/></div>
        {result?.insight&&<div style={{fontSize:11,color:C.sub,marginTop:10,lineHeight:1.6,fontStyle:"italic"}}>{result.insight}</div>}
        <div style={{marginTop:8,display:"flex",justifyContent:"flex-end"}}>
          <span style={{fontFamily:C.mono,fontSize:9,color:C.mute,textTransform:"uppercase",letterSpacing:".06em"}}>{result?.method==="claude"?T.mAI:T.mKW}</span>
        </div>
      </div>
    </div>
  );
}

function History({ logs }) {
  if(!logs.length)return(
    <div style={{textAlign:"center",padding:"60px 20px"}}>
      <div style={{fontFamily:C.mono,fontSize:32,color:C.border,marginBottom:16}}>[ ]</div>
      <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>{T.histEmpty}</div>
      <div style={{fontSize:13,color:C.sub}}>{T.histSub}</div>
    </div>
  );
  return(
    <div>
      {logs.map((log,i)=>(
        <div key={i} style={{...S.card,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {(log.ebtns||[]).map(k=>(
                <span key={k} style={{fontSize:11,background:T.emotions[k]?.bg||C.bg,color:T.emotions[k]?.color||C.sub,border:`1px solid ${T.emotions[k]?.border||C.border}`,borderRadius:6,padding:"2px 8px"}}>
                  {T.emoji[k]} {T.emotions[k]?.label}
                </span>
              ))}
              {log.bpm&&<span style={{fontFamily:C.mono,fontSize:11,color:bpmCol(log.bpm),background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"2px 8px"}}>{log.bpm} BPM</span>}
              {log.rel&&<span style={{fontSize:11,background:log.rel==="divergence"?C.accentBg:C.bg,color:log.rel==="divergence"?C.accent:C.mute,border:`1px solid ${log.rel==="divergence"?C.accentBorder:C.border}`,borderRadius:6,padding:"2px 8px"}}>{log.rel}</span>}
            </div>
            <span style={{fontFamily:C.mono,fontSize:10,color:C.mute,flexShrink:0,marginLeft:8}}>{log.time.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
          </div>
          {log.text&&<div style={{fontSize:12,color:C.sub,lineHeight:1.65,background:C.bg,borderRadius:8,padding:"10px 12px",marginBottom:log.bridge?8:0}}>{log.text}</div>}
          {log.result?.insight&&<div style={{fontSize:11,color:C.mute,fontStyle:"italic",marginTop:6,lineHeight:1.55}}>{log.result.insight}</div>}
          {log.bridge&&<div style={{fontSize:11,color:C.accent,background:C.accentBg,border:`1px solid ${C.accentBorder}`,borderRadius:7,padding:"6px 10px",marginTop:8}}>{T.histBridge} <strong>{log.bridge.concept}</strong></div>}
        </div>
      ))}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,   setTab]   = useState(0);
  const [sel,   setSel]   = useState([]);
  const [showH, setShowH] = useState(false);
  const [bpm,   setBpm]   = useState(null);
  const [text,  setText]  = useState("");
  const [load,  setLoad]  = useState(false);
  const [bLoad, setBLoad] = useState(false);
  const [res,   setRes]   = useState(null);
  const [brid,  setBrid]  = useState(null);
  const [cris,  setCris]  = useState(false);
  const [logs,  setLogs]  = useState([]);

  const toggle = (k) => {
    setSel(p => p.includes(k) ? p.filter(x=>x!==k) : [...p,k]);
    if(!showH) setShowH(true);
  };

  const obs = sel[0] ? T.obs[sel[0]] : null;

  const record = async () => {
    if(!text.trim()) return;
    setLoad(true); setBLoad(true); setRes(null); setBrid(null);
    setCris(isCrisis(text));
    try {
      const [r, b] = await Promise.all([
        (async()=>{ try{ return await aiAnalyze(text); } catch{ return localAnalyze(text); } })(),
        (async()=>{ try{ return await aiBridge(text);  } catch{ return null; } })(),
      ]);
      setRes(r); setBrid(b);
      const rel = (r&&bpm) ? relate(r.emotionState, bpm) : null;
      setLogs(p => [{ text, result:r, bridge:b, ebtns:[...sel], bpm, rel, time:new Date() }, ...p]);
    } finally { setLoad(false); setBLoad(false); }
  };

  const clear = () => { setText(""); setRes(null); setBrid(null); setBpm(null); setSel([]); setShowH(false); setCris(false); };

  return(
    <div style={S.root}>
      <header style={S.hdr}>
        <div>
          <div style={S.logoT}>Trace</div>
          <div style={S.logoS}>{T.subtitle}</div>
        </div>
      </header>
      <div style={S.tabs}>
        {T.tabs.map((n,i)=><button key={i} onClick={()=>setTab(i)} style={S.tab(tab===i)}>{n}</button>)}
      </div>
      <div style={S.body}>
        {tab===0&&(
          <div className="fade">
            <div style={S.card}>
              <div style={S.lbl}>30s</div>
              <EmotionBtns sel={sel} toggle={toggle}/>
              {obs&&<div style={S.obsCard}>{obs}</div>}
              {showH&&<HRV onBpm={b=>setBpm(b)}/>}
            </div>
            <div style={S.card}>
              <div style={S.lbl}>2min</div>
              <div style={S.ttl}>{T.textQ}</div>
              <div style={S.sub}>{T.textSub}</div>
              <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={T.ph} style={S.ta}/>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button onClick={record} disabled={load||!text.trim()} style={{...S.btn,flex:1,opacity:(!text.trim()||load)?0.5:1}}>
                  {load?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><Spin/> {T.analyzing}</span>:T.record}
                </button>
                {(text||res)&&<button onClick={clear} style={S.sec}>{T.clear}</button>}
              </div>
            </div>
            {cris&&<div style={S.crisisCard}><span style={{fontSize:12,color:"#991b1b"}}>{T.crisis} </span><span style={{fontSize:12,color:C.accent,fontWeight:600}}>{T.crisisLink}</span></div>}
            {(res||bLoad)&&<Results result={res} bridge={brid} bridgeLoading={bLoad} bpm={bpm} selEmotions={sel}/>}
          </div>
        )}
        {tab===1&&<div className="fade"><History logs={logs}/></div>}
      </div>
    </div>
  );
}