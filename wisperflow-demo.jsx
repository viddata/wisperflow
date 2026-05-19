import { useState, useEffect, useRef } from "react";

function WaveBars({ active, color = "#10b981", count = 20 }) {
  const [heights, setHeights] = useState(Array(count).fill(15));
  useEffect(() => {
    if (!active) { setHeights(Array(count).fill(15)); return; }
    const id = setInterval(() => {
      setHeights(Array(count).fill(0).map(() => Math.random() * 75 + 12));
    }, 100);
    return () => clearInterval(id);
  }, [active, count]);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:2.5, height:36 }}>
      {heights.map((h, i) => (
        <div key={i} style={{ width:3, height:`${h}%`, borderRadius:4, background:active?color:"rgba(255,255,255,0.08)", transition:"height 0.1s ease", minHeight:3 }} />
      ))}
    </div>
  );
}

function Spinner({ size = 14 }) {
  return <div style={{ width:size, height:size, border:`2px solid rgba(255,255,255,0.2)`, borderTop:`2px solid white`, borderRadius:"50%", animation:"spin 0.7s linear infinite", flexShrink:0 }} />;
}

export default function WisperFlow() {
  const [rawTranscript, setRawTranscript] = useState("");
  const [styledText, setStyledText]       = useState("");
  const [interimText, setInterimText]     = useState("");
  const [isListening, setIsListening]     = useState(false);
  const [isStylizing, setIsStylizing]     = useState(false);
  const [sttSupported, setSttSupported]   = useState(true);
  const [ttsInput, setTtsInput]           = useState("");
  const [isSpeaking, setIsSpeaking]       = useState(false);
  const [isCloning, setIsCloning]         = useState(false);
  const [voiceRecorded, setVoiceRecorded] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceSeconds, setVoiceSeconds]   = useState(0);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [pitch, setPitch]                 = useState(1);
  const [rate, setRate]                   = useState(1);
  const [elApiKey, setElApiKey]           = useState("");
  const [elVoiceId, setElVoiceId]         = useState("");
  const [elSaved, setElSaved]             = useState(false);
  const [audioUrl, setAudioUrl]           = useState(null);
  const [ttsMode, setTtsMode]             = useState("browser");
  const [tab, setTab]                     = useState("speak");
  const [examples, setExamples]           = useState([]);
  const [trainingInput, setTrainingInput] = useState("");
  const [anthropicKey, setAnthropicKey]   = useState("");
  const [anthropicSaved, setAnthropicSaved] = useState(false);
  const [copied, setCopied]               = useState(false);
  const [showSettings, setShowSettings]   = useState(false);
  const [voiceBlob, setVoiceBlob]         = useState(null);

  const recognitionRef  = useRef(null);
  const voiceMediaRef   = useRef(null);
  const voiceChunksRef  = useRef([]);
  const voiceTimerRef   = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSttSupported(false); return; }
    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = "en-US";
    r.onresult = (e) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      if (final) { setRawTranscript(p => p + (p?" ":"") + final); setInterimText(""); }
      else setInterimText(interim);
    };
    r.onerror = r.onend = () => setIsListening(false);
    recognitionRef.current = r;
  }, []);

  useEffect(() => {
    const load = () => {
      const voices = window.speechSynthesis?.getVoices() || [];
      setAvailableVoices(voices);
      if (voices.length > 0 && !selectedVoice) {
        setSelectedVoice(voices.find(v => v.lang.startsWith("en")) || voices[0]);
      }
    };
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, []);

  const toggleListening = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }
    else { try { recognitionRef.current?.start(); setIsListening(true); } catch { setSttSupported(false); } }
  };

  async function stylize(text) {
    const src = text || rawTranscript;
    if (!src.trim()) return;
    setIsStylizing(true);
    try {
      if (anthropicSaved && anthropicKey) {
        const styleCtx = examples.length
          ? `Writing examples:\n${examples.map((e,i)=>`${i+1}. "${e}"`).join("\n")}`
          : "No examples. Use natural, conversational tone.";
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method:"POST",
          headers:{ "Content-Type":"application/json","x-api-key":anthropicKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true" },
          body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1024, messages:[{ role:"user", content:`Rewrite this voice transcript to sound like this person writes.\n${styleCtx}\nRaw: "${src}"\nReturn ONLY the rewritten text.` }] })
        });
        const data = await res.json();
        const result = data.content?.[0]?.text || src;
        setStyledText(result); setTtsInput(result);
      } else {
        await new Promise(r => setTimeout(r, 900));
        const cleaned = src.replace(/\buh\b|\bum\b|\ber\b/gi,"").replace(/\s+/g," ").trim();
        const out = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        const final = /[.?!]$/.test(out) ? out : out + ".";
        setStyledText(final); setTtsInput(final);
      }
    } catch { setStyledText(src); setTtsInput(src); }
    finally { setIsStylizing(false); }
  }

  function speakBrowser(text) {
    window.speechSynthesis?.cancel();
    const utt = new SpeechSynthesisUtterance(text || ttsInput);
    if (selectedVoice) utt.voice = selectedVoice;
    utt.pitch = pitch; utt.rate = rate;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend = utt.onerror = () => setIsSpeaking(false);
    window.speechSynthesis?.speak(utt);
  }

  async function speakElevenLabs(text) {
    if (!elApiKey || !elVoiceId) return;
    setIsCloning(true); setAudioUrl(null);
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elVoiceId}`, {
        method:"POST",
        headers:{ "xi-api-key":elApiKey, "Content-Type":"application/json" },
        body:JSON.stringify({ text: text||ttsInput, model_id:"eleven_monolingual_v1", voice_settings:{ stability:0.5, similarity_boost:0.75 } })
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      const audio = new Audio(url);
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = audio.onerror = () => setIsSpeaking(false);
      audio.play();
    } catch(e) { console.error(e); }
    finally { setIsCloning(false); }
  }

  function handleSpeak(text) {
    if (ttsMode==="elevenlabs"&&elSaved) speakElevenLabs(text);
    else speakBrowser(text);
  }

  async function startVoiceRecord() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      voiceChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = e => voiceChunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type:"audio/webm" });
        setVoiceBlob(blob); setVoiceRecorded(true);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(); voiceMediaRef.current = mr;
      setIsRecordingVoice(true); setVoiceSeconds(0);
      voiceTimerRef.current = setInterval(() => setVoiceSeconds(p => p+1), 1000);
    } catch { alert("Microphone access denied."); }
  }

  function stopVoiceRecord() {
    voiceMediaRef.current?.stop();
    clearInterval(voiceTimerRef.current);
    setIsRecordingVoice(false);
  }

  function addExample() {
    if (!trainingInput.trim()) return;
    setExamples(p => [...p.slice(-9), trainingInput.trim()]);
    setTrainingInput("");
  }

  function copyText(t) { navigator.clipboard.writeText(t); setCopied(true); setTimeout(()=>setCopied(false),2000); }

  const displayText = rawTranscript + (interimText ? (rawTranscript?" ":"") + interimText : "");
  const englishVoices = availableVoices.filter(v => v.lang.startsWith("en"));

  const C = {
    app:     { minHeight:"100vh", background:"#07070d", color:"white", fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:14 },
    header:  { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 22px", borderBottom:"1px solid rgba(255,255,255,0.06)", position:"sticky", top:0, background:"rgba(7,7,13,0.95)", backdropFilter:"blur(12px)", zIndex:10 },
    main:    { maxWidth:840, margin:"0 auto", padding:"26px 18px 60px" },
    tabs:    { display:"flex", gap:3, marginBottom:20, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:4, width:"fit-content", flexWrap:"wrap" },
    tab:  a  => ({ padding:"7px 15px", borderRadius:10, fontSize:12.5, fontWeight:500, cursor:"pointer", border:"none", transition:"all 0.18s", background:a?"#059669":"none", color:a?"white":"rgba(255,255,255,0.38)" }),
    card:    { background:"rgba(255,255,255,0.035)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:18, padding:22, marginBottom:14 },
    label:   { fontSize:11, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8, display:"block" },
    row:     { display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" },
    input:   { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:10, padding:"9px 13px", fontSize:13, color:"rgba(255,255,255,0.82)", outline:"none", fontFamily:"monospace", width:"100%", boxSizing:"border-box" },
    textarea:{ width:"100%", minHeight:120, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:14, fontSize:13, fontFamily:"monospace", color:"rgba(255,255,255,0.8)", outline:"none", resize:"vertical", lineHeight:1.65, boxSizing:"border-box" },
    btn:  (c,d) => ({ padding:"9px 20px", background:d?"rgba(255,255,255,0.05)":c||"#059669", border:"none", borderRadius:11, color:d?"rgba(255,255,255,0.25)":"white", fontSize:13, cursor:d?"not-allowed":"pointer", fontWeight:500, display:"flex", alignItems:"center", gap:7, transition:"all 0.18s", flexShrink:0, whiteSpace:"nowrap" }),
    smBtn:   { padding:"7px 14px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:10, color:"rgba(255,255,255,0.5)", fontSize:12, cursor:"pointer", whiteSpace:"nowrap" },
    select:  { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:10, padding:"8px 12px", color:"white", fontSize:12, outline:"none", cursor:"pointer", width:"100%" },
    chip: a  => ({ padding:"5px 14px", borderRadius:20, fontSize:12, fontWeight:500, border:`1px solid ${a?"#10b981":"rgba(255,255,255,0.1)"}`, background:a?"rgba(16,185,129,0.12)":"rgba(255,255,255,0.03)", color:a?"#10b981":"rgba(255,255,255,0.4)", cursor:"pointer" }),
    divider: { height:1, background:"rgba(255,255,255,0.05)", margin:"16px 0" },
    warn:    { background:"rgba(251,191,36,0.05)", border:"1px solid rgba(251,191,36,0.15)", borderRadius:12, padding:"10px 14px", color:"rgba(251,191,36,0.8)", fontSize:12, marginBottom:14 },
    success: { background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.18)", borderRadius:12, padding:"10px 14px", color:"rgba(16,185,129,0.8)", fontSize:12, marginBottom:14 },
    range:   { width:"100%", accentColor:"#10b981", cursor:"pointer" },
    statBox: { background:"rgba(255,255,255,0.03)", borderRadius:12, padding:"14px", textAlign:"center", flex:1 },
  };

  return (
    <div style={C.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes pulseRed { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 50%{box-shadow:0 0 0 12px rgba(239,68,68,0)} }
        @keyframes pulseGreen { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.4)} 50%{box-shadow:0 0 0 12px rgba(16,185,129,0)} }
        * { box-sizing:border-box; } select option { background:#111; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-thumb { background:#222; border-radius:2px; }
      `}</style>

      {/* Header */}
      <header style={C.header}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:"linear-gradient(135deg,#10b981,#059669)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, color:"#000" }}>W</div>
          <span style={{ fontWeight:700, fontSize:17, letterSpacing:"-0.4px" }}>WisperFlow</span>
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.18)", fontFamily:"monospace" }}>v2</span>
        </div>
        <div style={C.row}>
          {anthropicSaved && <span style={{ fontSize:11, color:"rgba(16,185,129,0.65)" }}>● Claude</span>}
          {elSaved && <span style={{ fontSize:11, color:"rgba(139,92,246,0.65)" }}>● ElevenLabs</span>}
          <button style={C.smBtn} onClick={()=>setShowSettings(p=>!p)}>⚙️ Settings</button>
        </div>
      </header>

      <div style={C.main}>

        {/* Settings */}
        {showSettings && (
          <div style={C.card}>
            <div style={{ fontWeight:600, fontSize:15, marginBottom:16 }}>🔑 API Keys</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <div>
                <span style={C.label}>Anthropic (Claude) — Style correction</span>
                <input style={C.input} type="password" value={anthropicKey} onChange={e=>setAnthropicKey(e.target.value)} placeholder="sk-ant-..." />
                <div style={{ ...C.row, marginTop:8 }}>
                  <button style={C.btn(null, !anthropicKey)} onClick={()=>{ if(anthropicKey){setAnthropicSaved(true);setShowSettings(false);} }}>Save</button>
                  {anthropicSaved && <span style={{ fontSize:11, color:"#10b981" }}>✓ Active</span>}
                </div>
                <p style={{ fontSize:11, color:"rgba(255,255,255,0.22)", marginTop:6 }}>Free → console.anthropic.com</p>
              </div>
              <div>
                <span style={C.label}>ElevenLabs — Voice cloning TTS</span>
                <input style={C.input} type="password" value={elApiKey} onChange={e=>setElApiKey(e.target.value)} placeholder="API key..." />
                <input style={{ ...C.input, marginTop:6 }} value={elVoiceId} onChange={e=>setElVoiceId(e.target.value)} placeholder="Voice ID..." />
                <div style={{ ...C.row, marginTop:8 }}>
                  <button style={C.btn("#7c3aed", !elApiKey||!elVoiceId)} onClick={()=>{ if(elApiKey&&elVoiceId){setElSaved(true);setTtsMode("elevenlabs");setShowSettings(false);} }}>Save & Enable</button>
                  {elSaved && <span style={{ fontSize:11, color:"#8b5cf6" }}>✓ Active</span>}
                </div>
                <p style={{ fontSize:11, color:"rgba(255,255,255,0.22)", marginTop:6 }}>Free 10k chars/mo → elevenlabs.io</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={C.tabs}>
          {[["speak","🔊 Text → Voice"],["listen","🎙️ Voice → Text"],["voice","🎤 Voice Profile"],["train","🧠 Style Training"]].map(([id,label]) => (
            <button key={id} style={C.tab(tab===id)} onClick={()=>setTab(id)}>{label}</button>
          ))}
        </div>

        {/* ══ TEXT → VOICE ══ */}
        {tab==="speak" && (
          <>
            <div style={{ ...C.row, marginBottom:16 }}>
              <button style={C.chip(ttsMode==="browser")} onClick={()=>setTtsMode("browser")}>🌐 Browser Voice</button>
              <button style={C.chip(ttsMode==="elevenlabs")} onClick={()=>elSaved?setTtsMode("elevenlabs"):setShowSettings(true)}>
                🎤 Cloned Voice {!elSaved?"(setup ↗)":""}
              </button>
            </div>

            <div style={C.card}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:16 }}>Type to Speak</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:3 }}>
                    {ttsMode==="elevenlabs" ? "🎤 Streams through your cloned ElevenLabs voice" : "🌐 Uses browser voice with your pitch/speed settings"}
                  </div>
                </div>
                <WaveBars active={isSpeaking} color={ttsMode==="elevenlabs"?"#8b5cf6":"#10b981"} count={14} />
              </div>

              <textarea style={C.textarea} value={ttsInput} onChange={e=>setTtsInput(e.target.value)} placeholder={`Type or paste anything here...\n\nHint: Use "Voice → Text" tab to record → stylize → then come back here to hear it read back in your voice.`} />

              <div style={{ ...C.row, marginTop:14 }}>
                <button style={C.btn(ttsMode==="elevenlabs"?"#7c3aed":null, (!ttsInput)||(isSpeaking&&ttsMode==="browser")||isCloning)} onClick={()=>handleSpeak()} disabled={!ttsInput||isCloning}>
                  {isCloning?<><Spinner/>Generating...</>:isSpeaking?<><WaveBars active count={6}/>Speaking...</>: ttsMode==="elevenlabs"?"🎤 Speak (Cloned)":"🔊 Speak"}
                </button>
                {isSpeaking&&ttsMode==="browser" && <button style={C.btn("#374151",false)} onClick={()=>{window.speechSynthesis?.cancel();setIsSpeaking(false);}}>⏹ Stop</button>}
                {styledText && <button style={C.smBtn} onClick={()=>setTtsInput(styledText)}>← Use stylized text</button>}
                <button style={C.smBtn} onClick={()=>copyText(ttsInput)}>{copied?"✓":"📋 Copy"}</button>
                <button style={C.smBtn} onClick={()=>setTtsInput("")}>Clear</button>
              </div>

              {audioUrl&&ttsMode==="elevenlabs" && (
                <div style={{ marginTop:14, background:"rgba(139,92,246,0.06)", border:"1px solid rgba(139,92,246,0.15)", borderRadius:12, padding:12 }}>
                  <span style={{ fontSize:12, color:"rgba(139,92,246,0.8)" }}>🎧 Generated:</span>
                  <audio controls src={audioUrl} style={{ width:"100%", marginTop:8, height:36 }} />
                </div>
              )}
            </div>

            {/* Voice Controls (browser) */}
            {ttsMode==="browser" && (
              <div style={C.card}>
                <div style={{ fontWeight:600, fontSize:14, marginBottom:16 }}>🎛️ Voice Controls</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
                  <div>
                    <span style={C.label}>Voice ({englishVoices.length} English)</span>
                    <select style={C.select} value={selectedVoice?.name||""} onChange={e=>setSelectedVoice(availableVoices.find(v=>v.name===e.target.value))}>
                      {englishVoices.map(v=><option key={v.name} value={v.name}>{v.name.replace(/Microsoft |Google |Apple /g,"").trim()}</option>)}
                    </select>
                    <button style={{ ...C.smBtn, marginTop:8, fontSize:11 }} onClick={()=>{
                      const u=new SpeechSynthesisUtterance("Hi, this is a voice preview.");
                      if(selectedVoice)u.voice=selectedVoice; u.pitch=pitch; u.rate=rate;
                      window.speechSynthesis?.speak(u);
                    }}>▶ Preview</button>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                    <div>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                        <span style={{ fontSize:12, color:"rgba(255,255,255,0.45)" }}>Pitch</span>
                        <span style={{ fontSize:12, color:"#10b981", fontFamily:"monospace" }}>{pitch.toFixed(1)}x</span>
                      </div>
                      <input type="range" style={C.range} min="0.5" max="2" step="0.1" value={pitch} onChange={e=>setPitch(parseFloat(e.target.value))} />
                    </div>
                    <div>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                        <span style={{ fontSize:12, color:"rgba(255,255,255,0.45)" }}>Speed</span>
                        <span style={{ fontSize:12, color:"#10b981", fontFamily:"monospace" }}>{rate.toFixed(1)}x</span>
                      </div>
                      <input type="range" style={C.range} min="0.5" max="2" step="0.1" value={rate} onChange={e=>setRate(parseFloat(e.target.value))} />
                    </div>
                  </div>
                </div>
                <div style={C.divider} />
                <p style={{ fontSize:12, color:"rgba(255,255,255,0.28)", lineHeight:1.6, margin:0 }}>
                  💡 For true voice cloning, go to <strong style={{color:"rgba(255,255,255,0.45)"}}>Voice Profile</strong> tab → record 60s of your voice → upload to ElevenLabs → paste Voice ID in Settings.
                </p>
              </div>
            )}
          </>
        )}

        {/* ══ VOICE → TEXT ══ */}
        {tab==="listen" && (
          <>
            {!sttSupported && <div style={C.warn}>⚠️ Requires Chrome or Edge browser for voice recognition.</div>}
            <div style={C.card}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:16 }}>Voice to Text</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:3 }}>
                    {isListening?"🔴 Listening... speak naturally":"Press mic to start"}
                  </div>
                </div>
                <WaveBars active={isListening} />
              </div>

              <div style={{ display:"flex", justifyContent:"center", margin:"18px 0" }}>
                <button onClick={sttSupported?toggleListening:undefined} disabled={!sttSupported} style={{
                  width:84, height:84, borderRadius:"50%", border:"none", cursor:sttSupported?"pointer":"not-allowed", fontSize:32,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  background:isListening?"#ef4444":"#059669", transition:"all 0.25s",
                  transform:isListening?"scale(1.08)":"scale(1)",
                  animation:isListening?"pulseRed 1.5s ease infinite":"none",
                  boxShadow:isListening?"0 0 30px rgba(239,68,68,0.3)":"0 0 20px rgba(5,150,105,0.2)",
                }}>
                  {isListening?"⏹":"🎙️"}
                </button>
              </div>

              {displayText ? (
                <div style={{ minHeight:130, background:"rgba(255,255,255,0.03)", borderRadius:12, padding:14, fontSize:13, fontFamily:"monospace", lineHeight:1.7 }}>
                  <span style={{ color:"rgba(255,255,255,0.82)" }}>{rawTranscript}</span>
                  {interimText && <span style={{ color:"rgba(255,255,255,0.35)", fontStyle:"italic" }}>{rawTranscript?" ":""}{interimText}</span>}
                </div>
              ) : (
                <div style={{ minHeight:130, background:"rgba(255,255,255,0.02)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.15)", fontSize:12, fontStyle:"italic" }}>
                  Your words appear here in real-time...
                </div>
              )}

              <div style={{ ...C.row, justifyContent:"space-between", marginTop:12 }}>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.2)", fontFamily:"monospace" }}>{rawTranscript.split(/\s+/).filter(Boolean).length} words</span>
                <div style={C.row}>
                  <button style={C.smBtn} onClick={()=>{setRawTranscript("");setStyledText("");setInterimText("");setTtsInput("");}}>Clear</button>
                  <button style={C.smBtn} onClick={()=>copyText(rawTranscript)}>Copy raw</button>
                  <button style={C.btn(null,!rawTranscript||isStylizing)} onClick={()=>stylize()} disabled={!rawTranscript||isStylizing}>
                    {isStylizing?<><Spinner/>Stylizing...</>:"✨ Stylize + Read aloud"}
                  </button>
                </div>
              </div>
            </div>

            {styledText && (
              <div style={C.card}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                  <div style={{ fontWeight:600, fontSize:15 }}>✨ In Your Style</div>
                  <div style={C.row}>
                    <button style={C.smBtn} onClick={()=>copyText(styledText)}>{copied?"✓":"Copy"}</button>
                    <button style={C.btn(null,isSpeaking||isCloning)} onClick={()=>handleSpeak(styledText)} disabled={isSpeaking||isCloning}>
                      {isCloning?<><Spinner/>...</>:isSpeaking?"Speaking...":ttsMode==="elevenlabs"?"🎤 Speak":"🔊 Read aloud"}
                    </button>
                  </div>
                </div>
                <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:12, padding:14, fontSize:13, fontFamily:"monospace", lineHeight:1.7, color:"rgba(255,255,255,0.85)" }}>
                  {styledText}
                </div>
                <div style={{ ...C.row, justifyContent:"flex-end", marginTop:10 }}>
                  <button style={C.smBtn} onClick={()=>{setTab("speak");setTtsInput(styledText);}}>Open in TTS editor →</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══ VOICE PROFILE ══ */}
        {tab==="voice" && (
          <>
            <div style={C.card}>
              <div style={{ fontWeight:600, fontSize:16, marginBottom:6 }}>🎤 Record Your Voice Sample</div>
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.38)", marginBottom:18, lineHeight:1.6 }}>
                Record 60+ seconds of your natural voice reading the script below. Download it and upload to ElevenLabs to clone your voice for free.
              </div>

              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:16, marginBottom:18 }}>
                <span style={C.label}>📄 Read this aloud clearly while recording:</span>
                <p style={{ fontSize:13, lineHeight:1.9, color:"rgba(255,255,255,0.65)", fontStyle:"italic", margin:0 }}>
                  "The quick brown fox jumps over the lazy dog. I love working on interesting projects that challenge my thinking and push me to learn new things every single day. The weather outside is beautiful today — perfect for a walk or a long conversation with an old friend. Technology has changed the way we communicate, work, and connect with each other, but nothing replaces the warmth of a genuine human connection. I enjoy reading, cooking, listening to music, and discovering new ideas that surprise me in unexpected and wonderful ways. This is my voice, and I'm recording it so I can use it to power an AI voice clone that sounds just like me."
                </p>
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:18, flexWrap:"wrap" }}>
                <button
                  onClick={isRecordingVoice?stopVoiceRecord:startVoiceRecord}
                  style={{
                    width:64, height:64, borderRadius:"50%", border:"none", cursor:"pointer", fontSize:26,
                    background:isRecordingVoice?"#ef4444":"#7c3aed", display:"flex", alignItems:"center", justifyContent:"center",
                    animation:isRecordingVoice?"pulseRed 1.5s ease infinite":"none",
                    boxShadow:isRecordingVoice?"0 0 30px rgba(239,68,68,0.3)":"0 0 20px rgba(124,58,237,0.3)",
                    transition:"all 0.2s",
                  }}
                >
                  {isRecordingVoice?"⏹":"🎤"}
                </button>
                <div>
                  <div style={{ fontSize:13, fontWeight:500 }}>
                    {isRecordingVoice ? <span style={{color:"#ef4444"}}>● Recording... {voiceSeconds}s</span>
                     : voiceRecorded ? <span style={{color:"#10b981"}}>✓ Recorded ({voiceSeconds}s) — ready to download</span>
                     : <span style={{color:"rgba(255,255,255,0.45)"}}>Click to record</span>}
                  </div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", marginTop:2 }}>Aim for 60–90 seconds minimum</div>
                </div>
                {voiceRecorded && voiceBlob && (
                  <a href={URL.createObjectURL(voiceBlob)} download="my-voice-sample.webm"
                    style={{ ...C.btn("#374151",false), textDecoration:"none" }}>
                    ⬇ Download .webm
                  </a>
                )}
              </div>
            </div>

            {/* Step guide */}
            <div style={C.card}>
              <div style={{ fontWeight:600, fontSize:14, marginBottom:18 }}>🗺️ Clone Your Voice Free — Step by Step</div>
              {[
                { n:1, title:"Record your voice above", desc:"Read the script naturally. 60–90 seconds works best.", done:voiceRecorded },
                { n:2, title:"Download the .webm file", desc:'Hit "Download .webm" and save to your device.', done:voiceRecorded },
                { n:3, title:"Create free ElevenLabs account", desc:"Go to elevenlabs.io → Sign up (free, no card needed).", done:elSaved },
                { n:4, title:"Upload your voice sample", desc:"ElevenLabs → Voices → Add Voice → Instant Voice Clone → upload your .webm", done:elSaved },
                { n:5, title:"Copy your Voice ID", desc:"In your ElevenLabs voice list, click the voice → copy the ID from the URL or profile.", done:elSaved },
                { n:6, title:"Add keys in Settings above", desc:"Click ⚙️ Settings → paste ElevenLabs API key + Voice ID → Save & Enable.", done:elSaved },
                { n:7, title:"Go to Text → Voice tab", desc:'Switch mode to "Cloned Voice", type anything, and hear yourself!', done:false },
              ].map(({ n, title, desc, done }) => (
                <div key={n} style={{ display:"flex", gap:14, marginBottom:14 }}>
                  <div style={{ width:28, height:28, borderRadius:"50%", background:done?"rgba(16,185,129,0.12)":"rgba(255,255,255,0.05)", border:`1px solid ${done?"rgba(16,185,129,0.4)":"rgba(255,255,255,0.1)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:done?"#10b981":"rgba(255,255,255,0.35)", flexShrink:0, marginTop:1 }}>
                    {done?"✓":n}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500, color:done?"#10b981":"rgba(255,255,255,0.75)", marginBottom:2 }}>{title}</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.32)", lineHeight:1.55 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ ...C.card, background:"rgba(139,92,246,0.04)", borderColor:"rgba(139,92,246,0.12)" }}>
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.35)", lineHeight:1.7, margin:0 }}>
                🔒 <strong style={{color:"rgba(255,255,255,0.55)"}}>Privacy:</strong> Your voice sample stays in your browser until you choose to upload it to ElevenLabs. Your API keys are stored only in your browser's memory and never sent to any of our servers.
              </p>
            </div>
          </>
        )}

        {/* ══ STYLE TRAINING ══ */}
        {tab==="train" && (
          <>
            <div style={C.card}>
              <div style={{ fontWeight:600, fontSize:16, marginBottom:6 }}>🧠 Train Your Writing Style</div>
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.38)", marginBottom:18, lineHeight:1.6 }}>
                Paste examples of how you naturally write — texts, emails, Slack messages. Claude learns to rewrite transcriptions in your exact voice.
              </div>
              <textarea style={C.textarea} value={trainingInput} onChange={e=>setTrainingInput(e.target.value)}
                placeholder={`Paste something you wrote...\n\nE.g. "yo heads up - the build broke again lol, pushed a hotfix like 10 min ago. can someone sanity check before we push? also who's doing the demo tmrw, lmk asap"`}
              />
              <button style={{ ...C.btn(null,!trainingInput.trim()), marginTop:12 }} onClick={addExample} disabled={!trainingInput.trim()}>
                + Add Example
              </button>
            </div>

            <div style={C.card}>
              <div style={{ fontWeight:600, fontSize:14, marginBottom:14 }}>Profile Stats</div>
              <div style={{ display:"flex", gap:10 }}>
                {[
                  { n:examples.length, l:"style examples" },
                  { n:anthropicSaved?"AI":"Basic", l:"style engine" },
                  { n:ttsMode==="elevenlabs"&&elSaved?"Clone":"Browser", l:"voice engine" }
                ].map(({ n, l }) => (
                  <div key={l} style={C.statBox}>
                    <div style={{ fontSize:22, fontWeight:700, color:"#10b981", fontFamily:"monospace" }}>{n}</div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{l}</div>
                  </div>
                ))}
              </div>
              {examples.length > 0 && (
                <>
                  <div style={C.divider} />
                  <span style={C.label}>Recent examples</span>
                  {examples.slice(-3).map((ex,i)=>(
                    <div key={i} style={{ fontSize:12, color:"rgba(255,255,255,0.3)", fontFamily:"monospace", background:"rgba(255,255,255,0.02)", borderRadius:10, padding:11, marginBottom:7, lineHeight:1.5 }}>
                      "{ex.slice(0,130)}{ex.length>130?"...":""}"
                    </div>
                  ))}
                  <button style={{ fontSize:11, color:"rgba(239,68,68,0.45)", background:"none", border:"none", cursor:"pointer", marginTop:4 }} onClick={()=>setExamples([])}>
                    Reset profile
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign:"center", padding:20, fontSize:11, color:"rgba(255,255,255,0.1)", fontFamily:"monospace" }}>
        WisperFlow v2 • Voice to Text + Text to Voice + AI Style • Free & Open Source
      </div>
    </div>
  );
}
