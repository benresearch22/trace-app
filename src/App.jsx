import { useState, useRef } from "react";

const fl = document.createElement("link");
fl.rel = "stylesheet";
fl.href = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap";
document.head.appendChild(fl);

const C = {
  bg:"#f7f7f5", surface:"#ffffff", border:"#e4e4e0", text:"#18181a",
  sub:"#6b6b6b", mute:"#a8a8a0", accent:"#1a56db",
  accentBg:"#eff4ff", accentBorder:"#c3d4fb", danger:"#dc2626",
  mono:"'DM Mono',monospace", sans:"'Outfit',sans-serif",
};

const T = {
  subtitle:  "Your learning state, recorded",
  tabs:      ["Now","Record"],
  textQ:     "What is happening now?",
  textSub:   "Describe what you're working on, what's stuck, or what doesn't make sense.",
  ph:        "Examples:\n- My model accuracy keeps coming out low.\n- I can't see any pattern in the climate data.\n- Why does adding more data still give wrong predictions?",
  record:    "Record",
  analyzing: "Analyzing",
  clear:     "Clear",
  emotionQ:  "How did it feel?",
  emotionSub:"Pick what fits — multiple ok",
  emotions: {
    frustrated:{ label:"Stuck / Frustrated",  color:"#b45309", bg:"#fef3c7", border:"#fcd34d" },
    anxious:   { label:"Anxious / Tense",      color:"#dc2626", bg:"#fee2e2", border:"#fca5a5" },
    confused:  { label:"Confused / Wondering", color:"#7c3aed", bg:"#f5f3ff", border:"#c4b5fd" },
    curious:   { label:"Curious / Exploring",  color:"#0369a1", bg:"#e0f2fe", border:"#7dd3fc" },
    proud:     { label:"Got It / Proud",        color:"#166534", bg:"#dcfce7", border:"#86efac" },
  },
  emoji: { frustrated:"😤", anxious:"😰", confused:"🤔", curious:"🔍", proud:"✨" },
  hrvAsk:  "Add body signal?",
  hrvYes:  "Measure",
  hrvNo:   "Skip",
  hrvScan: "Measuring — keep face in frame",
  hrvErr:  "Camera unavailable",
  hrvSrc:  "rPPG · camera",
  bodyCh:  "Body Channel",
  bpmRange:(b) => b>=90?"Tense range":b>=65?"Stable range":"Relaxed range",
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
  relQ:       "What does this tell you?",
  textCh:     "Text Channel",
  cogLoad:    "Cognitive Load Signal",
  detected:   "Detected State",
  states:     { stressed:"High difficulty zone", struggling:"Repeated attempt pattern", curious:"Exploratory activity", positive:"Concept connected", neutral:"Analyzing" },
  mAI:"Claude", mKW:"Keyword",
  crisis:     "If things feel too heavy right now, reach out:",
  crisisLink: "988 Lifeline",
  histEmpty:  "No records yet",
  histSub:    "Start your first record in the Now tab.",
  histBridge: "Concept connection:",
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
const SW = ["frustrated","confused","stuck","lost","failed","error","wrong","can't","cannot","difficult","unclear","don't understand","can't figure","not working","doesn't work","keeps failing"];
const CW = ["why","how","wonder","curious","explore","what if","how does"];
const EW = ["tried","attempt","again","retry","kept","working on","trying","multiple times"];
const PW = ["got it","understand","works","solved","figured","makes sense","clicked","finally"];
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

const CRISIS_KW = ["kill myself","want to die","self harm","disappear","can't go on","end it all","no point living"];
const isCrisis = (t) => CRISIS_KW.some(w=>t.toLowerCase().includes(w));

// ─── API proxy ────────────────────────────────────────────────────────────────
async function callAPI(messages) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch("/api/analyze", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ messages, max_tokens:1000 }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    return await res.json();
  } catch(e) { clearTimeout(tid); throw e; }
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
  const hi=["stressed","struggling"], ok=["positive"], ex=["curious"], nu=["neutral"];
  const tense=bpm>=90, relax=bpm<65, stable=!tense&&!relax;
  if(hi.includes(es)&&tense)             return "match";
  if(ok.includes(es)&&(relax||stable))   return "match";
  if(ex.includes(es)&&stable)            return "match";
  if((nu.includes(es)||ok.includes(es))&&tense) return "divergence";
  if(hi.includes(es)&&relax)             return "divergence";
  return "partial";
}

const cogCol = (v) => v>70?"#b45309":v>40?"#d97706":"#059669";
const bpmCol = (b) => b>=90?"#dc2626":b>=65?"#059669":"#3b82f6";

// ─── CSS ──────────────────────────────────────────────────────────────────────
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

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spin() {
  return <span style={{display:"inline-block",width:12,height:12,border:`2px solid ${C.border}`,borderTopColor:C.text,borderRadius:"50%",animation:"spin .7s linear infinite",flexShrink:0}}/>;
}

// ─── rPPG ────────────────────────────────────────────────────────────────────
function HRV({ onBpm, onSkip }) {
  const [st, setSt] = useState("ask");
  const [bpm, setBpm] = useState(null);
  const vr=useRef(), cr=useRef(), sr=useRef(), rr=useRef(), buf=useRef([]);
  const stRef=useRef("ask"); // Tracks current status without stale closure issue
  const SR=30, BUF=150;

  // Keep stRef in sync with st state
  const updateSt=(s)=>{ stRef.current=s; setSt(s); };

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
    updateSt("scan");
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
          // Use stRef.current (not st) — reads live value, not stale closure
          if(bv>=40&&bv<=180){setBpm(bv);updateSt("done");onBpm(bv);sr.current?.getTracks().forEach(t=>t.stop());cancelAnimationFrame(rr.current);return;}
        }
        rr.current=requestAnimationFrame(loop);
      };
      rr.current=requestAnimationFrame(loop);
      // Use stRef.current (not st) to avoid stale closure in async setTimeout
      setTimeout(()=>{if(stRef.current!=="done"){updateSt("skip");sr.current?.getTracks().forEach(t=>t.stop());cancelAnimationFrame(rr.current);}},35000);
    } catch { updateSt("err"); }
  };

  const hidden=<><video ref={vr} style={{display:"none"}} playsInline muted/><canvas ref={cr} width={80} height={60} style={{display:"none"}}/></>;
  const divider={borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:10};

  if(st==="skip")return null;

  if(st==="ask")return(
    <div style={divider}>{hidden}
      <div style={{fontSize:11,color:C.mute,marginBottom:6}}>{T.hrvAsk}</div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={start} style={{flex:1,padding:"7px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11,color:C.sub,cursor:"pointer"}}>{T.hrvYes}</button>
        <button onClick={()=>{ updateSt("skip"); if(onSkip) onSkip(); }} style={{flex:1,padding:"7px",background:"none",border:"none",fontSize:11,color:C.mute,cursor:"pointer"}}>{T.hrvNo}</button>
      </div>
    </div>
  );
  if(st==="scan")return <div style={{...divider,display:"flex",alignItems:"center",gap:8}}>{hidden}<Spin/><span style={{fontSize:11,color:C.sub}}>{T.hrvScan}</span></div>;
  if(st==="err") return <div style={divider}>{hidden}<span style={{fontSize:11,color:C.danger}}>{T.hrvErr}</span></div>;
  if(st==="done"&&bpm)return(
    <div style={divider}>{hidden}
      <div style={{fontSize:11,color:C.mute,marginBottom:4}}>{T.bodyCh}</div>
      <div style={{display:"flex",alignItems:"baseline",gap:6}}>
        <span style={{fontFamily:C.mono,fontSize:22,fontWeight:500,color:bpmCol(bpm)}}>{bpm}</span>
        <span style={{fontSize:11,color:C.mute}}>BPM — {T.bpmRange(bpm)}</span>
      </div>
      <div style={{fontFamily:C.mono,fontSize:9,color:C.mute,marginTop:3}}>{T.hrvSrc}</div>
    </div>
  );
  return null;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,   setTab]   = useState(0);
  const [text,  setText]  = useState("");
  const [load,  setLoad]  = useState(false);
  const [bLoad, setBLoad] = useState(false);
  const [res,   setRes]   = useState(null);
  const [brid,  setBrid]  = useState(null);
  const [sel,         setSel]         = useState([]);
  const [bpm,         setBpm]         = useState(null);
  const [cris,        setCris]        = useState(false);
  const [logs,        setLogs]        = useState([]);
  const [showSignals, setShowSignals] = useState(false); // progressive reveal
  const [step, setStep] = useState(0); // 0=idle 1=bridge 2=emotion 3=hrv 4=compare

  const toggle = (k) => setSel(p=>p.includes(k)?p.filter(x=>x!==k):[...p,k]);

  const record = async () => {
    if(!text.trim()) return;
    setLoad(true); setBLoad(true); setRes(null); setBrid(null); setSel([]); setBpm(null); setShowSignals(false); setStep(0);
    setCris(isCrisis(text));
    try {
      const [r, b] = await Promise.all([
        (async()=>{ try{ return await aiAnalyze(text); } catch{ return localAnalyze(text); } })(),
        (async()=>{ try{ return await aiBridge(text);  } catch{ return null; } })(),
      ]);
      setRes(r); setBrid(b);
      setStep(1);
    } finally { setLoad(false); setBLoad(false); }
  };

  const save = () => {
    if(!res) return;
    const rel = (res&&bpm) ? relate(res.emotionState, bpm) : null;
    setLogs(p=>[{ text, result:res, bridge:brid, ebtns:[...sel], bpm, rel, time:new Date() }, ...p]);
    setText(""); setRes(null); setBrid(null); setSel([]); setBpm(null); setCris(false); setShowSignals(false);
  };

  const clear = () => { setText(""); setRes(null); setBrid(null); setSel([]); setBpm(null); setCris(false); setShowSignals(false); setStep(0); };

  // Divergence for state comparison
  const relKey = (res&&bpm) ? relate(res.emotionState, bpm) : sel.length>0&&bpm ? relate(sel[0], bpm) : null;
  const showCompare = res && (sel.length>0 || bpm);

  return(
    <div style={{fontFamily:C.sans,background:C.bg,minHeight:"100vh",color:C.text}}>

      {/* Header */}
      <header style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"14px 20px",position:"sticky",top:0,zIndex:100}}>
        <div style={{fontFamily:C.mono,fontSize:17,fontWeight:500,letterSpacing:"-0.02em"}}>Trace</div>
        <div style={{fontSize:11,color:C.mute,marginTop:2}}>{T.subtitle}</div>
      </header>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,background:C.surface,padding:"0 20px"}}>
        {T.tabs.map((n,i)=>(
          <button key={i} onClick={()=>setTab(i)} style={{fontFamily:C.sans,fontSize:13,fontWeight:tab===i?600:400,color:tab===i?C.text:C.mute,padding:"12px 0",marginRight:28,border:"none",background:"none",cursor:"pointer",borderBottom:`2px solid ${tab===i?C.text:"transparent"}`,transition:"all .15s"}}>
            {n}
          </button>
        ))}
      </div>

      <div style={{maxWidth:600,margin:"0 auto",padding:"20px 16px 60px"}}>

        {/* ── TAB 0: Now ── */}
        {tab===0&&(
          <div className="fade">

            {/* [1] Text input */}
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:18,marginBottom:10}}>
              <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:4}}>{T.textQ}</div>
              <div style={{fontSize:12,color:C.sub,marginBottom:12,lineHeight:1.5}}>{T.textSub}</div>
              <textarea
                value={text}
                onChange={e=>setText(e.target.value)}
                placeholder={T.ph}
                style={{width:"100%",minHeight:120,padding:"12px 14px",fontFamily:C.sans,fontSize:13,color:C.text,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,resize:"vertical",outline:"none",lineHeight:1.7,boxSizing:"border-box"}}
              />
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button onClick={record} disabled={load||!text.trim()} style={{flex:1,padding:12,background:(!text.trim()||load)?C.border:C.text,color:(!text.trim()||load)?C.mute:"#fff",border:"none",borderRadius:10,fontFamily:C.sans,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  {load?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><Spin/>{T.analyzing}</span>:T.record}
                </button>
                {(text||res)&&<button onClick={clear} style={{padding:"8px 16px",background:"none",color:C.sub,border:`1px solid ${C.border}`,borderRadius:8,fontFamily:C.sans,fontSize:12,cursor:"pointer"}}>{T.clear}</button>}
              </div>
            </div>

            {/* Crisis */}
            {cris&&(
              <div style={{background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:10,padding:"12px 16px",marginBottom:10}}>
                <span style={{fontSize:12,color:"#991b1b"}}>{T.crisis} </span>
                <span style={{fontSize:12,color:C.accent,fontWeight:600}}>{T.crisisLink}</span>
              </div>
            )}

            {/* [2] Science Bridge — step 1 */}
            {step >= 1 && (
              <div className="fade" style={{marginBottom:10}}>
                <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:16,marginBottom:10}}>
                  {bLoad&&!brid&&(
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <Spin/><span style={{fontSize:11,color:"#94a3b8"}}>Finding concept connections...</span>
                    </div>
                  )}
                  {!bLoad&&brid&&(
                    <>
                      <div style={{fontFamily:C.mono,fontSize:9,color:"#64748b",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Science Bridge</div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                        <span style={{fontSize:18}}>{brid.icon}</span>
                        <div>
                          <div style={{fontSize:13,fontWeight:600,color:"#f8fafc"}}>{brid.domain}</div>
                          <div style={{fontSize:11,color:"#94a3b8"}}>{brid.concept}</div>
                        </div>
                      </div>
                      <div style={{fontSize:10,color:"#94a3b8",fontWeight:500,textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{T.bridgeDiag}</div>
                      <div style={{fontSize:12,color:"#cbd5e1",lineHeight:1.7,marginBottom:10}}>{brid.diagnosis}</div>
                      <div style={{fontSize:12,color:"#e2e8f0",lineHeight:1.7,marginBottom:10}} dangerouslySetInnerHTML={{__html:brid.explanation.replace(/\*\*(.*?)\*\*/g,'<strong style="color:#fff">$1</strong>')}}/>
                      {brid.nextStep&&(
                        <div style={{borderTop:"1px solid #1e293b",paddingTop:8}}>
                          <div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{T.bridgeNext}</div>
                          <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.5}}>{brid.nextStep}</div>
                        </div>
                      )}
                    </>
                  )}
                  {!bLoad&&!brid&&(
                    <>
                      <div style={{fontFamily:C.mono,fontSize:9,color:"#64748b",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Science Bridge</div>
                      <div style={{fontSize:11,color:"#475569",lineHeight:1.6}}>No concept connection detected for this entry.</div>
                    </>
                  )}
                </div>

                {/* Step 1 → 2: prompt for emotion */}
                {step===1&&!bLoad&&(
                  <button
                    onClick={()=>setStep(2)}
                    className="fade"
                    style={{width:"100%",padding:"12px 16px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,fontFamily:C.sans,fontSize:13,color:C.sub,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}
                  >
                    <span>Want to see more about your state?</span>
                    <span style={{fontSize:11,color:C.mute}}>↓</span>
                  </button>
                )}
              </div>
            )}

            {/* [3] Emotion — step 2 */}
            {step >= 2 && (
              <div className="fade" style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:10}}>
                <div style={{fontFamily:C.mono,fontSize:9,color:C.mute,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>{T.emotionQ}</div>
                <div style={{fontSize:11,color:C.mute,marginBottom:10}}>{T.emotionSub}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:4}}>
                  {Object.entries(T.emotions).map(([k,e])=>{
                    const s=sel.includes(k);
                    return(
                      <button key={k} onClick={()=>{
                        toggle(k);
                        if(step===2) setStep(3); // advance to HRV after first selection
                      }} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 10px",border:`1.5px solid ${s?e.border:C.border}`,borderRadius:8,background:s?e.bg:C.bg,cursor:"pointer",textAlign:"left",transition:"all .1s"}}>
                        <span style={{fontSize:16}}>{T.emoji[k]}</span>
                        <span style={{fontSize:11,fontWeight:s?600:400,color:s?e.color:C.sub,lineHeight:1.2}}>{e.label}</span>
                      </button>
                    );
                  })}
                  <div/>
                </div>
              </div>
            )}

            {/* [4] HRV — step 3 */}
            {step >= 3 && (
              <div className="fade" style={{marginBottom:10}}>
                <HRV onBpm={b=>{setBpm(b); setStep(4);}} onSkip={()=>setStep(4)}/>
              </div>
            )}

            {/* [5] State Comparison — step 4 */}
            {step >= 4 && (sel.length>0||bpm) && (()=>{
              const rel = relKey || "partial";
              const tlbl = sel.length>0 ? sel.map(k=>T.emotions[k]?.label).join(" / ") : T.states[res?.emotionState]||"Neutral";
              const rtxt = rel==="match"?T.relMatch:rel==="divergence"?T.relDiv:T.relPart;
              const rcol = rel==="divergence"?C.accent:C.text;
              const bord = rel==="divergence"?`1.5px solid ${C.accentBorder}`:`1px solid ${C.border}`;
              const robs = T.relObs[rel==="match"?"match":rel==="divergence"?"divergence":"partial"];
              return(
                <div className="fade" style={{background:C.surface,border:bord,borderRadius:12,padding:"16px 18px",marginBottom:10}}>
                  <div style={{fontFamily:C.mono,fontSize:9,color:C.mute,textTransform:"uppercase",letterSpacing:".08em",marginBottom:12}}>{T.compLabel}</div>
                  <div style={{display:"grid",gridTemplateColumns:bpm?"1fr 1fr":"1fr",gap:10,marginBottom:14}}>
                    <div style={{background:C.bg,borderRadius:8,padding:"10px 12px"}}>
                      <div style={{fontFamily:C.mono,fontSize:9,color:C.mute,textTransform:"uppercase",letterSpacing:".06em",marginBottom:5}}>{T.compText}</div>
                      <div style={{fontSize:12,fontWeight:500,lineHeight:1.4}}>{tlbl}</div>
                      {res?.insight&&<div style={{fontSize:11,color:C.sub,marginTop:5,lineHeight:1.5,fontStyle:"italic"}}>{res.insight}</div>}
                    </div>
                    {bpm&&(
                      <div style={{background:C.bg,borderRadius:8,padding:"10px 12px"}}>
                        <div style={{fontFamily:C.mono,fontSize:9,color:C.mute,textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>{T.compBody}</div>
                        <div style={{fontSize:12,fontWeight:500,color:bpmCol(bpm),lineHeight:1.4}}>
                          {bpm>=90?T.bpmH:bpm>=65?T.bpmM:T.bpmL}
                        </div>
                        <div style={{fontFamily:C.mono,fontSize:9,color:C.mute,marginTop:4}}>{T.hrvSrc}</div>
                      </div>
                    )}
                  </div>
                  <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
                    <div style={{fontFamily:C.mono,fontSize:9,color:C.mute,textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>{T.compRel}</div>
                    <div style={{fontSize:13,fontWeight:500,color:rcol,marginBottom:6}}>{rtxt}</div>
                    <div style={{fontSize:11,color:C.sub,lineHeight:1.6,marginBottom:6}}>{robs}</div>
                    <div style={{fontSize:11,color:C.mute,fontStyle:"italic"}}>{T.relQ}</div>
                  </div>
                </div>
              );
            })()}

            {/* Save button — Text Channel just above, step 4 */}
            {step >= 4 && res&&(
              <>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:18,marginBottom:10}}>
                  <div style={{fontFamily:C.mono,fontSize:9,color:C.mute,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>{T.textCh}</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                    <span style={{fontSize:11,color:C.sub}}>{T.detected}</span>
                    <span style={{fontFamily:C.mono,fontSize:11,fontWeight:500}}>{T.states[res.emotionState]}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                    <span style={{fontSize:11,color:C.sub}}>{T.cogLoad}</span>
                    <span style={{fontFamily:C.mono,fontSize:11,fontWeight:500,color:cogCol(res.cogLoad||0)}}>{res.cogLoad??"-"}%</span>
                  </div>
                  <div style={{height:3,background:C.border,borderRadius:99,overflow:"hidden",marginTop:6}}>
                    <div style={{height:"100%",width:`${res.cogLoad||0}%`,background:cogCol(res.cogLoad||0),borderRadius:99,transition:"width .8s ease"}}/>
                  </div>
                  <div style={{marginTop:8,display:"flex",justifyContent:"flex-end"}}>
                    <span style={{fontFamily:C.mono,fontSize:9,color:C.mute,textTransform:"uppercase",letterSpacing:".06em"}}>{res.method==="claude"?T.mAI:T.mKW}</span>
                  </div>
                </div>
                <button onClick={save} style={{width:"100%",padding:12,background:C.text,color:"#fff",border:"none",borderRadius:10,fontFamily:C.sans,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  Save to journal
                </button>
              </>
            )}

          </div>
        )}

        {/* ── TAB 1: Record ── */}
        {tab===1&&(
          <div className="fade">
            {!logs.length?(
              <div style={{textAlign:"center",padding:"60px 20px"}}>
                <div style={{fontFamily:C.mono,fontSize:32,color:C.border,marginBottom:16}}>[ ]</div>
                <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>{T.histEmpty}</div>
                <div style={{fontSize:13,color:C.sub}}>{T.histSub}</div>
              </div>
            ):(
              <div>
                {logs.map((log,i)=>(
                  <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:18,marginBottom:10}}>
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
            )}
          </div>
        )}

      </div>
    </div>
  );
}