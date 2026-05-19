// app/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface StyleProfile {
  corrections: Array<{ original: string; corrected: string }>;
  vocab: string[];
  tone: string;
  examples: string[];
}

// ─── Web Speech API wrapper ───────────────────────────────────────────────────
function useSpeechRecognition(onResult: (text: string, isFinal: boolean) => void) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const SR = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      if (final) onResult(final, true);
      else if (interim) onResult(interim, false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, [onResult]);

  const start = useCallback(() => {
    recognitionRef.current?.start();
    setIsListening(true);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, start, stop, supported };
}

// ─── Style Profile Storage ────────────────────────────────────────────────────
const PROFILE_KEY = "wisperflow_style_profile";

function loadProfile(): StyleProfile {
  try {
    const stored = localStorage.getItem(PROFILE_KEY);
    return stored ? JSON.parse(stored) : { corrections: [], vocab: [], tone: "casual", examples: [] };
  } catch { return { corrections: [], vocab: [], tone: "casual", examples: [] }; }
}

function saveProfile(profile: StyleProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

// ─── Wave Bars Animation ──────────────────────────────────────────────────────
function WaveBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-[3px] h-10">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-emerald-400 transition-all duration-150"
          style={{
            height: active ? `${Math.random() * 80 + 20}%` : "15%",
            opacity: active ? 1 : 0.3,
            animation: active ? `wave ${0.5 + Math.random() * 0.5}s ease-in-out infinite alternate` : "none",
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes wave {
          from { height: 15%; }
          to { height: ${Math.random() * 60 + 40}%; }
        }
      `}</style>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function WisperFlow() {
  const [rawTranscript, setRawTranscript] = useState("");
  const [styledTranscript, setStyledTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [profile, setProfile] = useState<StyleProfile>({ corrections: [], vocab: [], tone: "casual", examples: [] });
  const [isStylizing, setIsStylizing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"record" | "train" | "output">("record");
  const [trainingInput, setTrainingInput] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
    const key = localStorage.getItem("wisperflow_api_key");
    if (key) setHasApiKey(true);
  }, []);

  const handleResult = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      setRawTranscript(prev => prev + (prev ? " " : "") + text);
      setInterimText("");
    } else {
      setInterimText(text);
    }
  }, []);

  const { isListening, start, stop, supported } = useSpeechRecognition(handleResult);

  // ── Stylize via Claude API route ──────────────────────────────────────────
  async function stylize() {
    if (!rawTranscript.trim()) return;
    setIsStylizing(true);
    try {
      const res = await fetch("/api/stylize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawTranscript, profile }),
      });
      const data = await res.json();
      setStyledTranscript(data.result || rawTranscript);
      setTab("output");
    } catch {
      setStyledTranscript(rawTranscript);
      setTab("output");
    } finally {
      setIsStylizing(false);
    }
  }

  // ── Train style from example ──────────────────────────────────────────────
  function trainFromExample() {
    if (!trainingInput.trim()) return;
    const updated = {
      ...profile,
      examples: [...profile.examples.slice(-9), trainingInput.trim()],
      vocab: [...new Set([...profile.vocab, ...trainingInput.split(/\s+/).filter(w => w.length > 4)])].slice(-200),
    };
    setProfile(updated);
    saveProfile(updated);
    setTrainingInput("");
  }

  // ── Save API key ──────────────────────────────────────────────────────────
  function saveApiKey() {
    if (!apiKeyInput.trim()) return;
    localStorage.setItem("wisperflow_api_key", apiKeyInput.trim());
    setHasApiKey(true);
    setShowKeyInput(false);
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function clearAll() {
    setRawTranscript("");
    setStyledTranscript("");
    setInterimText("");
  }

  const displayText = rawTranscript + (interimText ? (rawTranscript ? " " : "") + interimText : "");

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-['DM_Sans',system-ui]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: #10b98150; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .glass { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(12px); }
        .glow { box-shadow: 0 0 30px rgba(16,185,129,0.3); }
        .pulse-ring { animation: pulse-ring 2s ease-in-out infinite; }
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
          50% { box-shadow: 0 0 0 12px rgba(16,185,129,0); }
        }
        .fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        .shimmer {
          background: linear-gradient(90deg, #1a1a2e 25%, #16213e 50%, #1a1a2e 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-black font-bold text-sm">
            W
          </div>
          <span className="font-semibold tracking-tight text-lg">WisperFlow</span>
          <span className="text-xs text-white/30 font-['Space_Mono']">v1.0</span>
        </div>
        <div className="flex items-center gap-3">
          {!hasApiKey && (
            <button
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="text-xs text-amber-400/80 border border-amber-400/20 px-3 py-1.5 rounded-lg hover:border-amber-400/50 transition-colors"
            >
              + Add API Key (for style AI)
            </button>
          )}
          {hasApiKey && (
            <span className="text-xs text-emerald-400/60 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Style AI ready
            </span>
          )}
          <span className="text-xs text-white/20 font-['Space_Mono']">
            {profile.examples.length} examples trained
          </span>
        </div>
      </header>

      {/* API Key Banner */}
      {showKeyInput && (
        <div className="mx-6 mt-4 glass rounded-xl p-4 fade-in">
          <p className="text-sm text-white/60 mb-3">Enter your Anthropic API key (stored locally, never sent to our servers):</p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              placeholder="sk-ant-..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500/50 font-['Space_Mono'] text-white/80"
            />
            <button onClick={saveApiKey} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Save
            </button>
          </div>
          <p className="text-xs text-white/30 mt-2">
            Get free key at <span className="text-emerald-400/70">console.anthropic.com</span>
          </p>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* Tabs */}
        <div className="flex gap-1 mb-6 glass rounded-xl p-1 w-fit">
          {(["record", "train", "output"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                tab === t
                  ? "bg-emerald-600 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {t === "record" ? "🎙️ Record" : t === "train" ? "🧠 Train Style" : "✨ Output"}
            </button>
          ))}
        </div>

        {/* ── RECORD TAB ── */}
        {tab === "record" && (
          <div className="space-y-4 fade-in">
            {!supported && (
              <div className="glass rounded-xl p-4 border border-amber-500/20 text-amber-400 text-sm">
                ⚠️ Your browser doesn't support Web Speech API. Use Chrome or Edge.
              </div>
            )}

            {/* Recorder Card */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-semibold text-lg">Voice Input</h2>
                  <p className="text-sm text-white/40 mt-0.5">
                    {isListening ? "Listening... speak naturally" : "Click to start recording"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <WaveBars active={isListening} />
                </div>
              </div>

              {/* Big Record Button */}
              <div className="flex justify-center my-6">
                <button
                  onClick={isListening ? stop : start}
                  disabled={!supported}
                  className={`relative w-24 h-24 rounded-full flex items-center justify-center text-3xl transition-all duration-300 ${
                    isListening
                      ? "bg-red-500 glow pulse-ring scale-110"
                      : "bg-emerald-600 hover:bg-emerald-500 hover:scale-105"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {isListening ? "⏹" : "🎙️"}
                </button>
              </div>

              {/* Transcript Display */}
              <div
                className={`min-h-[140px] bg-white/[0.03] rounded-xl p-4 font-['Space_Mono'] text-sm leading-relaxed ${
                  !displayText ? "flex items-center justify-center" : ""
                }`}
              >
                {displayText ? (
                  <>
                    <span className="text-white/80">{rawTranscript}</span>
                    {interimText && (
                      <span className="text-white/40 italic">
                        {rawTranscript ? " " : ""}{interimText}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-white/20 text-center text-xs">
                    Your transcription will appear here...
                  </span>
                )}
              </div>

              {/* Word count */}
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-white/25 font-['Space_Mono']">
                  {rawTranscript.split(/\s+/).filter(Boolean).length} words
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={clearAll}
                    className="text-xs text-white/30 hover:text-white/60 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-all"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => copyText(rawTranscript)}
                    className="text-xs text-white/50 hover:text-white/80 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-all"
                  >
                    {copied ? "✓ Copied" : "Copy raw"}
                  </button>
                  <button
                    onClick={stylize}
                    disabled={!rawTranscript || isStylizing}
                    className="text-xs bg-emerald-700 hover:bg-emerald-600 px-4 py-1.5 rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {isStylizing ? (
                      <>
                        <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                        Stylizing...
                      </>
                    ) : "✨ Make it sound like me"}
                  </button>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="glass rounded-xl p-4 grid grid-cols-3 gap-4 text-center">
              {[
                { icon: "🗣️", tip: "Speak naturally", sub: "Don't worry about filler words" },
                { icon: "🧠", tip: "Train your style", sub: "Paste examples in Train tab" },
                { icon: "✨", tip: "Click Stylize", sub: "Claude rewrites in your voice" },
              ].map(({ icon, tip, sub }) => (
                <div key={tip}>
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className="text-xs font-medium text-white/70">{tip}</div>
                  <div className="text-xs text-white/30 mt-0.5">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TRAIN TAB ── */}
        {tab === "train" && (
          <div className="space-y-4 fade-in">
            <div className="glass rounded-2xl p-6">
              <h2 className="font-semibold text-lg mb-1">Train Your Writing Style</h2>
              <p className="text-sm text-white/40 mb-5">
                Paste examples of how you naturally write — messages, emails, notes. The more you add, the better it learns your voice.
              </p>

              <textarea
                value={trainingInput}
                onChange={e => setTrainingInput(e.target.value)}
                placeholder={`Paste something you wrote here...\n\nExample: "yo bro the meeting got pushed to tmrw, can u ping me when ur free? also the docs are in the shared drive fyi"`}
                className="w-full h-40 bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-sm font-['Space_Mono'] text-white/75 outline-none focus:border-emerald-500/40 resize-none placeholder-white/20"
              />

              <button
                onClick={trainFromExample}
                disabled={!trainingInput.trim()}
                className="mt-3 bg-emerald-700 hover:bg-emerald-600 px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
              >
                + Add to Style Profile
              </button>
            </div>

            {/* Style stats */}
            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-medium text-white/60 mb-4">Your Style Profile</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.03] rounded-xl p-3">
                  <div className="text-2xl font-['Space_Mono'] text-emerald-400">{profile.examples.length}</div>
                  <div className="text-xs text-white/40 mt-0.5">examples trained</div>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3">
                  <div className="text-2xl font-['Space_Mono'] text-emerald-400">{profile.vocab.length}</div>
                  <div className="text-xs text-white/40 mt-0.5">vocabulary words</div>
                </div>
              </div>

              {profile.examples.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-white/30 mb-2">Recent examples:</p>
                  <div className="space-y-2">
                    {profile.examples.slice(-3).map((ex, i) => (
                      <div key={i} className="text-xs text-white/40 bg-white/[0.02] rounded-lg p-3 font-['Space_Mono'] line-clamp-2">
                        "{ex.slice(0, 120)}{ex.length > 120 ? "..." : ""}"
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {profile.examples.length > 0 && (
                <button
                  onClick={() => {
                    const cleared = { corrections: [], vocab: [], tone: "casual", examples: [] };
                    setProfile(cleared);
                    saveProfile(cleared);
                  }}
                  className="mt-4 text-xs text-red-400/50 hover:text-red-400 transition-colors"
                >
                  Reset style profile
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── OUTPUT TAB ── */}
        {tab === "output" && (
          <div className="space-y-4 fade-in">
            {styledTranscript ? (
              <>
                <div className="glass rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-semibold text-lg">✨ Stylized Output</h2>
                      <p className="text-sm text-white/40 mt-0.5">Rewritten to sound like you</p>
                    </div>
                    <button
                      onClick={() => copyText(styledTranscript)}
                      className="text-sm bg-emerald-700/60 hover:bg-emerald-700 px-4 py-2 rounded-xl transition-all"
                    >
                      {copied ? "✓ Copied!" : "Copy"}
                    </button>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-5 text-sm leading-relaxed text-white/85 font-['Space_Mono'] whitespace-pre-wrap">
                    {styledTranscript}
                  </div>
                </div>

                {/* Compare */}
                <div className="glass rounded-2xl p-5">
                  <h3 className="text-xs text-white/30 uppercase tracking-wider mb-3">Raw transcript</h3>
                  <div className="text-sm text-white/35 font-['Space_Mono'] leading-relaxed">
                    {rawTranscript}
                  </div>
                </div>
              </>
            ) : (
              <div className="glass rounded-2xl p-12 text-center">
                <div className="text-4xl mb-4">🎙️</div>
                <p className="text-white/40 text-sm">
                  Record something and click "Make it sound like me" to see the output here.
                </p>
                <button
                  onClick={() => setTab("record")}
                  className="mt-4 text-sm text-emerald-400/70 hover:text-emerald-400 transition-colors"
                >
                  → Go to Record
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-white/20 font-['Space_Mono']">
        WisperFlow • Free & Open Source • Deployed on Vercel
      </footer>
    </div>
  );
}
