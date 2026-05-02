import { useState, useRef } from "react";

const FONT_LINK = document.createElement("link");
FONT_LINK.rel = "stylesheet";
FONT_LINK.href = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap";
document.head.appendChild(FONT_LINK);

const TOKENS = {
  bg:"#f7f7f5",surface:"#ffffff",border:"#e4e4e0",text:"#18181a",
  textSub:"#6b6b6b",textMute:"#a8a8a0",accent:"#1a56db",
  accentBg:"#eff4ff",accentBorder:"#c3d4fb",danger:"#dc2626",
  mono:"'DM Mono', monospace",sans:"'Outfit', sans-serif",
};
const T = {
  appTitle:"Trace",appSubtitle:"Your learning state, recorded",tabs:["Now","Record"],
  emotionPrompt:"What is your current state?",emotionSub:"Multiple selections allowed",
  emotions:{
    frustrated:{label:"Stuck / Frustrated",color:"#b45309",bg:"#fef3c7",border:"#fcd34d"},
    anxious:{label:"Anxious / Tense",color:"#dc2626",bg:"#fee2e2",border:"#fca5a5"},
    confused:{label:"Confused / Wondering",color:"#7c3aed",bg:"#f5f3ff",border:"#c4b5fd"},
    curious:{label:"Curious / Exploring",color:"#0369a1",bg:"#e0f2fe",border:"#7dd3fc"},
    proud:{label:"Got It / Proud",color:"#166534",bg:"#dcfce7",border:"#86efac"},
  },
  emotionEmoji:{frustrated:"😤",anxious:"😰",confused:"🤔",curious:"🔍",proud:"✨"},
  immediateObs:{
    frustrated:"Consistent with high cognitive load processing.",
    anxious:"Physiological response to uncertainty detected.",
    confused:"Concept-bridging process in progress.",
    curious:"Exploratory cognitive activity active.",
    proud:"Concept connection signal detected.",
  },
  hrvOptinTitle:"Add body channel to this record?",
  hrvOptinYes:"Measure this session",hrvOptinNo:"Skip",
  hrvScanning:"Measuring heart rate signal",hrvError:"Camera access failed",
  textPrompt:"Describe what is not working",
  textSub:"Error messages, concepts that won't click, unexpected results — more specific = more accurate",
  placeholder:"Examples:\n- My model accuracy keeps coming out low.\n- I can't see any pattern in the climate data.\n- Why does adding more data still give wrong predictions?",
  recordBtn:"Record",recordingBtn:"Analyzing",clearBtn:"Clear",
  textChannelLabel:"Text Channel",cogLoadLabel:"Cognitive Load Signal",stateLabel:"Detected State",
  stateMap:{stressed:"High difficulty zone",struggling:"Repeated attempt pattern",curious:"Exploratory activity",positive:"Concept connected",neutral:"Analyzing"},
  methodAI:"Claude",methodKW:"Keyword",
  bodyChannelLabel:"Body Channel",
  bpmRange:(b)=>b>=90?"Tense range":b>=65?"Stable range":"Relaxed range",
  bridgeDiag:"Problem diagnosis",bridgeNext:"Try this now",
  comparisonLabel:"State Comparison",compTextLabel:"Text state",compBodyLabel:"Body signal",compResultLabel:"Relationship",
  bpmRangeHigh:"HR up — Tense range",bpmRangeMid:"HR stable — Normal range",bpmRangeLow:"HR down — Relaxed range",
  relationMatch:"Both channels point in the same direction",
  relationDivergence:"Two channels are sending different signals",
  relationPartial:"Signals from both channels are mixed",
  compQuestion:"What does this tell you?",
  crisisMsg:"If things feel too heavy right now, reach out here:",crisisLink:"Crisis Lifeline: 988",
  historyEmpty:"No records yet",historyEmptySub:"Start your first record in the Now tab.",historyBridge:"Concept connection:",
  promptAnalysis:(text)=>`You are a Learning Sciences expert. Analyze the student input and return ONLY valid JSON — no markdown, no preamble.
Student input: "${text}"
Return this exact JSON shape:
{"emotionState":"stressed|struggling|curious|positive|neutral","stressScore":0,"curiosityScore":0,"effortScore":0,"positiveScore":0,"cogLoad":0,"insight":"one sentence observing the cognitive state — no emotional judgment","method":"claude"}
Rules:
- emotionState: stressed=high cognitive load unsolved / struggling=repeated attempts / curious=exploratory / positive=concept connected / neutral=no clear signal
- cogLoad: integer 0-100
- insight: observational only, no encouragement`,
  promptBridge:(text)=>`You are a Learning Sciences expert. If the student input connects to a science or ML concept, return ONLY valid JSON.
Student input: "${text}"
If relevant: {"relevant":true,"domain":"domain name","concept":"core concept","icon":"emoji","diagnosis":"2-sentence diagnosis","explanation":"2-3 sentence explanation, **bold** ok","nextStep":"one actionable step"}
If not relevant: {"relevant":false}`,
};
const STRESS_W=["frustrated","confused","stuck","lost","failed","error","wrong","can't","cannot","impossible","hopeless","difficult","unclear","don't understand","can't figure","not working","doesn't work"];
const CURIOSITY_W=["why","how","wonder","curious","explore","discover","what if","how does","what causes"];
const EFFORT_W=["tried","attempt","again","retry","kept","working on","trying","multiple times","keep trying"];
const POSITIVE_W=["got it","understand","works","solved","figured","makes sense","clicked","finally","it works"];
const NEGATION=["don't understand","can't figure","doesn't make sense","not working","doesn't work"];
const CRISIS_KW=["kill myself","want to die","self harm","disappear","can't go on","end it all","no point living"];

function localAnalyze(text){
  const lower=text.toLowerCase();
  const negHit=NEGATION.filter(p=>lower.includes(p)).length;
  const stress=STRESS_W.filter(w=>lower.includes(w)).length+negHit;
  const curiosity=CURIOSITY_W.filter(w=>lower.includes(w)).length;
  const effort=EFFORT_W.filter(w=>lower.includes(w)).length;
  const positive=Math.max(0,POSITIVE_W.filter(w=>lower.includes(w)).length-negHit);
  const total=stress+curiosity+effort+positive||1;
  const cogLoad=Math.min(100,Math.round(((stress*3+effort)/(total+1))*70+Math.min(20,text.length/6)));
  const emotionState=stress>=2?"stressed":stress===1?"struggling":effort>0?"struggling":curiosity>0?"curious":positive>0?"positive":"neutral";
  return{stressScore:stress,curiosityScore:curiosity,effortScore:effort,positiveScore:positive,cogLoad,emotionState,method:"keyword"};
}

function checkCrisis(text){return CRISIS_KW.some(w=>text.toLowerCase().includes(w));}

async function claudeAnalyze(text){
  const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:T.promptAnalysis(text)}]})});
  const data=await res.json();
  const raw=data.content?.map(b=>b.text||"").join("").trim();
  return JSON.parse(raw.replace(/```json|```/g,"").trim());
}

async function generateBridge(text){
  const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:T.promptBridge(text)}]})});
  const data=await res.json();
  const raw=data.content?.map(b=>b.text||"").join("").trim();
  const parsed=JSON.parse(raw.replace(/```json|```/g,"").trim());
  return parsed.relevant===false?null:parsed;
}

function computeRelationship(emotionState,bpm){
  const highLoad=["stressed","struggling"],resolved=["positive"],exploring=["curious"],neutral=["neutral"];
  const tense=bpm>=90,relaxed=bpm<65,stable=!tense&&!relaxed;
  if(highLoad.includes(emotionState)&&tense)return"match";
  if(resolved.includes(emotionState)&&(relaxed||stable))return"match";
  if(exploring.includes(emotionState)&&stable)return"match";
  if((neutral.includes(emotionState)||resolved.includes(emotionState))&&tense)return"divergence";
  if(highLoad.includes(emotionState)&&relaxed)return"divergence";
  return"partial";
}

function cogColor(v){return v>70?"#b45309":v>40?"#d97706":"#059669";}
function bpmColor(b){return b>=90?"#dc2626":b>=65?"#059669":"#3b82f6";}
const S={
  root:{fontFamily:TOKENS.sans,background:TOKENS.bg,minHeight:"100vh",color:TOKENS.text},
  header:{background:TOKENS.surface,borderBottom:`1px solid ${TOKENS.border}`,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100},
  logoTitle:{fontFamily:TOKENS.mono,fontSize:17,fontWeight:500,letterSpacing:"-0.02em",color:TOKENS.text},
  logoSub:{fontSize:11,color:TOKENS.textMute,fontWeight:400,marginTop:2},
  tabBar:{display:"flex",borderBottom:`1px solid ${TOKENS.border}`,background:TOKENS.surface,padding:"0 20px"},
  tabBtn:(a)=>({fontFamily:TOKENS.sans,fontSize:13,fontWeight:a?600:400,color:a?TOKENS.text:TOKENS.textMute,padding:"12px 0",marginRight:28,border:"none",background:"none",cursor:"pointer",borderBottom:`2px solid ${a?TOKENS.text:"transparent"}`,transition:"all 0.15s"}),
  body:{maxWidth:600,margin:"0 auto",padding:"20px 16px 60px"},
  section:{background:TOKENS.surface,border:`1px solid ${TOKENS.border}`,borderRadius:12,padding:"18px",marginBottom:10},
  sectionLabel:{fontFamily:TOKENS.mono,fontSize:10,fontWeight:500,color:TOKENS.textMute,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10},
  sectionTitle:{fontSize:15,fontWeight:600,color:TOKENS.text,marginBottom:3},
  sectionSub:{fontSize:12,color:TOKENS.textSub,marginBottom:14,lineHeight:1.5},
  emotionGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8},
  emotionBtn:(sel,cfg)=>({display:"flex",alignItems:"center",gap:10,padding:"12px 14px",border:`1.5px solid ${sel?cfg.border:TOKENS.border}`,borderRadius:10,background:sel?cfg.bg:TOKENS.surface,cursor:"pointer",transition:"all 0.12s",textAlign:"left"}),
  emotionLabel:(sel,cfg)=>({fontSize:12,fontWeight:sel?600:400,color:sel?cfg.color:TOKENS.textSub,lineHeight:1.3}),
  obsCard:{background:TOKENS.accentBg,border:`1px solid ${TOKENS.accentBorder}`,borderRadius:8,padding:"10px 14px",marginTop:10,fontSize:12,color:TOKENS.accent,lineHeight:1.6},
  textarea:{width:"100%",minHeight:120,padding:"12px 14px",fontFamily:TOKENS.sans,fontSize:13,color:TOKENS.text,background:TOKENS.bg,border:`1px solid ${TOKENS.border}`,borderRadius:10,resize:"vertical",outline:"none",lineHeight:1.7,boxSizing:"border-box"},
  primaryBtn:{width:"100%",padding:"12px",background:TOKENS.text,color:"#fff",border:"none",borderRadius:10,fontFamily:TOKENS.sans,fontSize:13,fontWeight:600,cursor:"pointer",letterSpacing:"0.01em"},
  secondaryBtn:{padding:"8px 16px",background:"none",color:TOKENS.textSub,border:`1px solid ${TOKENS.border}`,borderRadius:8,fontFamily:TOKENS.sans,fontSize:12,cursor:"pointer"},
  channelLabel:(c)=>({fontFamily:TOKENS.mono,fontSize:9,fontWeight:500,letterSpacing:"0.1em",textTransform:"uppercase",color:c||TOKENS.textMute,marginBottom:6}),
  dataRow:{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4},
  dataLabel:{fontSize:11,color:TOKENS.textSub},
  dataValue:{fontFamily:TOKENS.mono,fontSize:11,fontWeight:500,color:TOKENS.text},
  bar:{height:3,background:TOKENS.border,borderRadius:99,overflow:"hidden",marginTop:8},
  barFill:(pct,color)=>({height:"100%",width:`${pct}%`,background:color||TOKENS.text,borderRadius:99,transition:"width 0.8s ease"}),
  bridgeCard:{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:"16px 18px",marginBottom:10},
  crisisCard:{background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:10,padding:"12px 16px",marginBottom:10},
};

const styleEl=document.createElement("style");
styleEl.textContent=`
  @keyframes trace-spin{to{transform:rotate(360deg);}}
  @keyframes trace-fade{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
  .trace-fade{animation:trace-fade 0.2s ease;}
  *{box-sizing:border-box;}
  button{font-family:'Outfit',sans-serif;}
  textarea:focus{border-color:#18181a!important;}
`;
document.head.appendChild(styleEl);

function Spinner(){
  return <span style={{display:"inline-block",width:12,height:12,border:`2px solid ${TOKENS.border}`,borderTopColor:TOKENS.text,borderRadius:"50%",animation:"trace-spin 0.7s linear infinite",flexShrink:0}}/>;
}

function EmotionButtons({selected,onToggle}){
  const keys=["frustrated","anxious","confused","curious","proud"];
  return(
    <div>
      <div style={S.sectionTitle}>{T.emotionPrompt}</div>
      <div style={{...S.sectionSub,marginBottom:12}}>{T.emotionSub}</div>
      <div style={S.emotionGrid}>
        {keys.map(k=>{
          const cfg=T.emotions[k],sel=selected.includes(k);
          return(
            <button key={k} onClick={()=>onToggle(k)} style={S.emotionBtn(sel,cfg)}>
              <span style={{fontSize:20,lineHeight:1,flexShrink:0}}>{T.emotionEmoji[k]}</span>
              <span style={S.emotionLabel(sel,cfg)}>{cfg.label}</span>
            </button>
          );
        })}
        {keys.length%2!==0&&<div/>}
      </div>
    </div>
  );
}

function HRVSection({onBpm}){
  const [status,setStatus]=useState("ask");
  const [bpm,setBpm]=useState(null);
  const videoRef=useRef(null),canvasRef=useRef(null),streamRef=useRef(null),rafRef=useRef(null),bufRef=useRef([]);
  const SR=30,BUF=150;

  function extractBpm(buf){
    const n=buf.length,mean=buf.reduce((a,b)=>a+b,0)/n,x=buf.map(v=>v-mean);
    const re=new Array(n).fill(0),im=new Array(n).fill(0);
    for(let k=0;k<n;k++)for(let t=0;t<n;t++){const a=(2*Math.PI*k*t)/n;re[k]+=x[t]*Math.cos(a);im[k]+=x[t]*Math.sin(a);}
    const mag=re.map((r,i)=>Math.sqrt(r*r+im[i]*im[i]));
    let maxMag=0,bestK=0;
    for(let k=1;k<n/2;k++){const hz=(k*SR)/n;if(hz>=0.67&&hz<=3&&mag[k]>maxMag){maxMag=mag[k];bestK=k;}}
    return Math.round((bestK*SR)/n*60);
  }

  const startRPPG=async()=>{
    setStatus("scanning");
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:160,height:120,frameRate:{ideal:30}}});
      streamRef.current=stream;videoRef.current.srcObject=stream;await videoRef.current.play();
      bufRef.current=[];let fc=0;
      const ctx=canvasRef.current.getContext("2d");
      const loop=()=>{
        if(!videoRef.current||videoRef.current.paused)return;
        ctx.drawImage(videoRef.current,0,0,80,60);
        const px=ctx.getImageData(0,0,80,60).data;
        let g=0;for(let i=0;i<px.length;i+=4)g+=px[i+1];
        bufRef.current.push(g/(px.length/4));
        if(bufRef.current.length>BUF)bufRef.current.shift();
        fc++;
        if(fc%(SR*5)===0&&bufRef.current.length>=BUF){
          const b=extractBpm(bufRef.current);
          if(b>=40&&b<=180){setBpm(b);setStatus("done");onBpm(b);streamRef.current?.getTracks().forEach(tk=>tk.stop());cancelAnimationFrame(rafRef.current);return;}
        }
        rafRef.current=requestAnimationFrame(loop);
      };
      rafRef.current=requestAnimationFrame(loop);
      setTimeout(()=>{if(status!=="done"){setStatus("error");streamRef.current?.getTracks().forEach(tk=>tk.stop());cancelAnimationFrame(rafRef.current);}},35000);
    }catch{setStatus("error");}
  };

  if(status==="skip")return null;
  const hidden=<><video ref={videoRef} style={{display:"none"}} playsInline muted/><canvas ref={canvasRef} width={80} height={60} style={{display:"none"}}/></>;
  const row={display:"flex",alignItems:"center",gap:10,marginTop:10,padding:"8px 2px",borderTop:`1px solid ${TOKENS.border}`};

  if(status==="ask")return(
    <div style={row}>{hidden}
      <span style={{fontSize:12,color:TOKENS.textSub,flex:1}}>{T.hrvOptinTitle}</span>
      <button onClick={startRPPG} style={{...S.secondaryBtn,fontSize:11,padding:"5px 12px"}}>{T.hrvOptinYes}</button>
      <button onClick={()=>setStatus("skip")} style={{...S.secondaryBtn,fontSize:11,padding:"5px 12px",border:"none",color:TOKENS.textMute}}>{T.hrvOptinNo}</button>
    </div>
  );
  if(status==="scanning")return <div style={row}>{hidden}<Spinner/><span style={{fontSize:12,color:TOKENS.textSub}}>{T.hrvScanning}</span></div>;
  if(status==="error")return <div style={row}>{hidden}<span style={{fontSize:12,color:TOKENS.danger}}>{T.hrvError}</span></div>;
  if(status==="done"&&bpm)return(
    <div style={row}>{hidden}
      <span style={{fontSize:12,color:TOKENS.textSub,flex:1}}>{T.bodyChannelLabel}</span>
      <span style={{fontFamily:TOKENS.mono,fontSize:14,fontWeight:500,color:bpmColor(bpm)}}>{bpm}</span>
      <span style={{fontSize:11,color:TOKENS.textMute}}>BPM — {T.bpmRange(bpm)}</span>
    </div>
  );
  return null;
}

function ComparisonCard({result,bpm,selectedEmotions}){
  if(!bpm||!result)return null;
  const relation=computeRelationship(result.emotionState,bpm);
  const bpmStr=bpm>=90?T.bpmRangeHigh:bpm>=65?T.bpmRangeMid:T.bpmRangeLow;
  const textLabel=selectedEmotions.length>0?selectedEmotions.map(k=>T.emotions[k]?.label||k).join(" / "):T.stateMap[result.emotionState]||result.emotionState;
  const relationText=relation==="match"?T.relationMatch:relation==="divergence"?T.relationDivergence:T.relationPartial;
  const relationColor=relation==="divergence"?TOKENS.accent:TOKENS.text;
  const cardBorder=relation==="divergence"?`1.5px solid ${TOKENS.accentBorder}`:`1px solid ${TOKENS.border}`;
  return(
    <div style={{background:TOKENS.surface,border:cardBorder,borderRadius:12,padding:"16px 18px",marginBottom:10}}>
      <div style={S.channelLabel()}>{T.comparisonLabel}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div style={{background:TOKENS.bg,borderRadius:8,padding:"10px 12px"}}>
          <div style={{fontFamily:TOKENS.mono,fontSize:9,color:TOKENS.textMute,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>{T.compTextLabel}</div>
          <div style={{fontSize:12,fontWeight:500,color:TOKENS.text,lineHeight:1.4}}>{textLabel}</div>
        </div>
        <div style={{background:TOKENS.bg,borderRadius:8,padding:"10px 12px"}}>
          <div style={{fontFamily:TOKENS.mono,fontSize:9,color:TOKENS.textMute,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>{T.compBodyLabel}</div>
          <div style={{fontSize:12,fontWeight:500,color:bpmColor(bpm),lineHeight:1.4}}>{bpmStr}</div>
        </div>
      </div>
      <div style={{borderTop:`1px solid ${TOKENS.border}`,paddingTop:10}}>
        <div style={{fontFamily:TOKENS.mono,fontSize:9,color:TOKENS.textMute,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>{T.compResultLabel}</div>
        <div style={{fontSize:13,fontWeight:500,color:relationColor}}>{relationText}</div>
        <div style={{fontSize:11,color:TOKENS.textMute,marginTop:4,fontStyle:"italic"}}>{T.compQuestion}</div>
      </div>
    </div>
  );
}

function ResultCards({result,bridge,bridgeLoading,bpm,selectedEmotions}){
  const state=result?.emotionState||"neutral";
  return(
    <div style={{marginTop:10}}>
      {bridgeLoading&&<div style={{...S.section,display:"flex",alignItems:"center",gap:10}}><Spinner/><span style={{fontSize:12,color:TOKENS.textSub}}>Finding concept connections...</span></div>}
      {!bridgeLoading&&bridge&&(
        <div style={S.bridgeCard}>
          <div style={S.channelLabel("#64748b")}>Science Bridge</div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <span style={{fontSize:20}}>{bridge.icon}</span>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"#f8fafc"}}>{bridge.domain}</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>{bridge.concept}</div>
            </div>
          </div>
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{T.bridgeDiag}</div>
          <div style={{fontSize:12,color:"#cbd5e1",lineHeight:1.7,marginBottom:12}}>{bridge.diagnosis}</div>
          <div style={{fontSize:12,color:"#e2e8f0",lineHeight:1.7,marginBottom:12}} dangerouslySetInnerHTML={{__html:bridge.explanation.replace(/\*\*(.*?)\*\*/g,'<strong style="color:#fff">$1</strong>')}}/>
          {bridge.nextStep&&<div style={{borderTop:"1px solid #1e293b",paddingTop:10}}>
            <div style={{fontSize:11,color:"#64748b",fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{T.bridgeNext}</div>
            <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.6}}>{bridge.nextStep}</div>
          </div>}
        </div>
      )}
      <ComparisonCard result={result} bpm={bpm} selectedEmotions={selectedEmotions}/>
      <div style={S.section}>
        <div style={S.channelLabel()}>{T.textChannelLabel}</div>
        <div style={S.dataRow}><span style={S.dataLabel}>{T.stateLabel}</span><span style={S.dataValue}>{T.stateMap[state]}</span></div>
        <div style={S.dataRow}>
          <span style={S.dataLabel}>{T.cogLoadLabel}</span>
          <span style={{...S.dataValue,color:cogColor(result?.cogLoad||0)}}>{result?.cogLoad??"—"}%</span>
        </div>
        <div style={S.bar}><div style={S.barFill(result?.cogLoad||0,cogColor(result?.cogLoad||0))}/></div>
        {result?.insight&&<div style={{fontSize:11,color:TOKENS.textSub,marginTop:10,lineHeight:1.6,fontStyle:"italic"}}>{result.insight}</div>}
        <div style={{marginTop:8,display:"flex",justifyContent:"flex-end"}}>
          <span style={{fontFamily:TOKENS.mono,fontSize:9,color:TOKENS.textMute,textTransform:"uppercase",letterSpacing:"0.06em"}}>{result?.method==="claude"?T.methodAI:T.methodKW}</span>
        </div>
      </div>
    </div>
  );
}

function HistoryTab({logs}){
  if(logs.length===0)return(
    <div style={{textAlign:"center",padding:"60px 20px"}}>
      <div style={{fontFamily:TOKENS.mono,fontSize:32,color:TOKENS.border,marginBottom:16}}>[ ]</div>
      <div style={{fontSize:15,fontWeight:600,color:TOKENS.text,marginBottom:6}}>{T.historyEmpty}</div>
      <div style={{fontSize:13,color:TOKENS.textSub}}>{T.historyEmptySub}</div>
    </div>
  );
  return(
    <div>
      {logs.map((log,i)=>(
        <div key={i} style={{...S.section,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {(log.emotionButtons||[]).map(k=>(
                <span key={k} style={{fontSize:11,background:T.emotions[k]?.bg||TOKENS.bg,color:T.emotions[k]?.color||TOKENS.textSub,border:`1px solid ${T.emotions[k]?.border||TOKENS.border}`,borderRadius:6,padding:"2px 8px"}}>
                  {T.emotionEmoji[k]} {T.emotions[k]?.label}
                </span>
              ))}
              {log.bpm&&<span style={{fontFamily:TOKENS.mono,fontSize:11,color:bpmColor(log.bpm),background:TOKENS.bg,border:`1px solid ${TOKENS.border}`,borderRadius:6,padding:"2px 8px"}}>{log.bpm} BPM</span>}
              {log.relation&&<span style={{fontSize:11,background:log.relation==="divergence"?TOKENS.accentBg:TOKENS.bg,color:log.relation==="divergence"?TOKENS.accent:TOKENS.textMute,border:`1px solid ${log.relation==="divergence"?TOKENS.accentBorder:TOKENS.border}`,borderRadius:6,padding:"2px 8px"}}>{log.relation}</span>}
            </div>
            <span style={{fontFamily:TOKENS.mono,fontSize:10,color:TOKENS.textMute,flexShrink:0,marginLeft:8}}>{log.time.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
          </div>
          {log.text&&<div style={{fontSize:12,color:TOKENS.textSub,lineHeight:1.65,background:TOKENS.bg,borderRadius:8,padding:"10px 12px",marginBottom:log.bridge?8:0}}>{log.text}</div>}
          {log.result?.insight&&<div style={{fontSize:11,color:TOKENS.textMute,fontStyle:"italic",marginTop:6,lineHeight:1.55}}>{log.result.insight}</div>}
          {log.bridge&&<div style={{fontSize:11,color:TOKENS.accent,background:TOKENS.accentBg,border:`1px solid ${TOKENS.accentBorder}`,borderRadius:7,padding:"6px 10px",marginTop:8}}>{T.historyBridge} <strong>{log.bridge.concept}</strong></div>}
        </div>
      ))}
    </div>
  );
}

export default function App(){
  const [tab,setTab]=useState(0);
  const [selectedEmotions,setSelectedEmotions]=useState([]);
  const [showHRV,setShowHRV]=useState(false);
  const [bpm,setBpm]=useState(null);
  const [text,setText]=useState("");
  const [loading,setLoading]=useState(false);
  const [bridgeLoading,setBridgeLoading]=useState(false);
  const [result,setResult]=useState(null);
  const [bridge,setBridge]=useState(null);
  const [crisis,setCrisis]=useState(false);
  const [logs,setLogs]=useState([]);

  const toggleEmotion=(k)=>{
    setSelectedEmotions(prev=>prev.includes(k)?prev.filter(x=>x!==k):[...prev,k]);
    if(!showHRV)setShowHRV(true);
  };

  const primaryEmotion=selectedEmotions[0];
  const immediateObs=primaryEmotion?T.immediateObs[primaryEmotion]:null;

  const handleRecord=async()=>{
    if(!text.trim())return;
    setLoading(true);setBridgeLoading(true);setResult(null);setBridge(null);
    setCrisis(checkCrisis(text));
    try{
      const [analysisResult,bridgeResult]=await Promise.all([
        (async()=>{try{return await claudeAnalyze(text);}catch{return localAnalyze(text);}})(),
        (async()=>{try{return await generateBridge(text);}catch{return null;}})(),
      ]);
      setResult(analysisResult);setBridge(bridgeResult);
      const relation=(analysisResult&&bpm)?computeRelationship(analysisResult.emotionState,bpm):null;
      setLogs(prev=>[{text,result:analysisResult,bridge:bridgeResult,emotionButtons:[...selectedEmotions],bpm,relation,time:new Date()},...prev]);
    }finally{setLoading(false);setBridgeLoading(false);}
  };

  const handleClear=()=>{setText("");setResult(null);setBridge(null);setBpm(null);setSelectedEmotions([]);setShowHRV(false);setCrisis(false);};

  return(
    <div style={S.root}>
      <header style={S.header}>
        <div>
          <div style={S.logoTitle}>Trace</div>
          <div style={S.logoSub}>{T.appSubtitle}</div>
        </div>
      </header>
      <div style={S.tabBar}>
        {T.tabs.map((name,i)=><button key={i} onClick={()=>setTab(i)} style={S.tabBtn(tab===i)}>{name}</button>)}
      </div>
      <div style={S.body}>
        {tab===0&&(
          <div className="trace-fade">
            <div style={S.section}>
              <div style={S.sectionLabel}>30s</div>
              <EmotionButtons selected={selectedEmotions} onToggle={toggleEmotion}/>
              {immediateObs&&<div style={S.obsCard}>{immediateObs}</div>}
              {showHRV&&<HRVSection onBpm={b=>setBpm(b)}/>}
            </div>
            <div style={S.section}>
              <div style={S.sectionLabel}>2min</div>
              <div style={S.sectionTitle}>{T.textPrompt}</div>
              <div style={S.sectionSub}>{T.textSub}</div>
              <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={T.placeholder} style={S.textarea}/>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button onClick={handleRecord} disabled={loading||!text.trim()} style={{...S.primaryBtn,flex:1,opacity:(!text.trim()||loading)?0.5:1}}>
                  {loading?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><Spinner/> {T.recordingBtn}</span>:T.recordBtn}
                </button>
                {(text||result)&&<button onClick={handleClear} style={S.secondaryBtn}>{T.clearBtn}</button>}
              </div>
            </div>
            {crisis&&(
              <div style={S.crisisCard}>
                <span style={{fontSize:12,color:"#991b1b"}}>{T.crisisMsg} </span>
                <span style={{fontSize:12,color:TOKENS.accent,fontWeight:600}}>{T.crisisLink}</span>
              </div>
            )}
            {(result||bridgeLoading)&&<ResultCards result={result} bridge={bridge} bridgeLoading={bridgeLoading} bpm={bpm} selectedEmotions={selectedEmotions}/>}
          </div>
        )}
        {tab===1&&<div className="trace-fade"><HistoryTab logs={logs}/></div>}
      </div>
    </div>
  );
}