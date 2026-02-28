import { useState, useEffect, useRef } from "react";

const SONGS = {
  azizam: {
    name: "Azizam",
    src: "./azizam.mp3",
    wood: {
      bg: "#3d1c02",
      mid: "#5c2d0a",
      light: "#7a3d12",
      dark: "#1a0800",
      grain: "#2a1200",
    },
    accent: "#c8860a",
    glow: "255,140,0",
  },
  lovelyday: {
    name: "Lovely Day",
    src: "./lovelyday.mp3",
    wood: {
      bg: "#8b5e1a",
      mid: "#b07a22",
      light: "#d4962c",
      dark: "#5a3d0a",
      grain: "#7a5214",
    },
    accent: "#f0c040",
    glow: "255,200,50",
  },
};

function DustParticle({ style }) {
  return (
    <div
      style={{
        position: "absolute",
        width: "3px",
        height: "3px",
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(255,210,100,0.9), transparent)",
        boxShadow: "0 0 6px rgba(255,180,50,0.6)",
        animation: `dustFloat ${style.duration}s ease-in-out ${style.delay}s infinite`,
        left: `${style.left}%`,
        bottom: `${style.bottom}%`,
        opacity: 0,
      }}
    />
  );
}

export default function JetsMusicBox() {
  const [song, setSong] = useState("azizam");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState({ azizam: false, lovelyday: false });
  const [keyAngle, setKeyAngle] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [glowPulse, setGlowPulse] = useState(0);

  const audioCtxRef = useRef(null);
  const audioBuffersRef = useRef({ azizam: null, lovelyday: null });
  const sourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const keyRef = useRef(null);
  const prevAngleRef = useRef(null);
  const lastClickRef = useRef(0);
  const songRef = useRef(song);
  const glowIntervalRef = useRef(null);

  songRef.current = song;

  // Load both MP3s via fetch -> AudioContext decodeAudioData
  useEffect(() => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;

    const load = async (src, key) => {
      try {
        const res = await fetch(src);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        audioBuffersRef.current[key] = buffer;
        setIsLoaded((prev) => ({ ...prev, [key]: true }));
      } catch (e) {
        console.error("Failed to load audio:", key, e);
      }
    };

    load(SONGS.azizam.src, "azizam");
    load(SONGS.lovelyday.src, "lovelyday");

    return () => ctx.close();
  }, []);

  function playClick() {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const now = ctx.currentTime;
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] =
          (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.01));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.07, now);
      src.connect(g);
      g.connect(ctx.destination);
      src.start(now);
    } catch (e) {}
  }

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {}
      sourceNodeRef.current = null;
    }
    clearInterval(glowIntervalRef.current);
    setIsPlaying(false);
    setGlowPulse(0);
  };

  const startAudio = (songKey) => {
    const ctx = audioCtxRef.current;
    const buffer = audioBuffersRef.current[songKey];
    if (!ctx || !buffer) return;
    if (ctx.state === "suspended") ctx.resume();
    stopAudio();

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.playbackRate.value = 1.0;

    const gain = ctx.createGain();
    gain.gain.value = 1.0;

    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    sourceNodeRef.current = src;
    gainNodeRef.current = gain;
    setIsPlaying(true);

    let phase = 0;
    glowIntervalRef.current = setInterval(() => {
      phase += 0.06;
      setGlowPulse(0.6 + Math.sin(phase) * 0.4);
    }, 30);
  };

  const getAngle = (e, center) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return Math.atan2(clientY - center.y, clientX - center.x) * (180 / Math.PI);
  };

  const onKeyMouseDown = (e) => {
    e.preventDefault();
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "suspended") ctx.resume();

    const rect = keyRef.current.getBoundingClientRect();
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    prevAngleRef.current = getAngle(e, center);
    setIsDragging(true);

    const onMove = (ev) => {
      const angle = getAngle(ev, center);
      let delta = angle - prevAngleRef.current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      prevAngleRef.current = angle;
      if (delta > 0) {
        setKeyAngle((a) => a + delta);
        const now = Date.now();
        if (now - lastClickRef.current > 80) {
          playClick();
          lastClickRef.current = now;
        }
      }
    };

    const onUp = () => {
      setIsDragging(false);
      prevAngleRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
      startAudio(songRef.current);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
  };

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => setKeyAngle((a) => a - 0.8), 30);
    return () => clearInterval(id);
  }, [isPlaying]);

  const handleSongSwitch = (newSong) => {
    stopAudio();
    setSong(newSong);
  };

  const songData = SONGS[song];
  const w = songData.wood;
  const bothLoaded = isLoaded.azizam && isLoaded.lovelyday;
  const TOTAL_WIDTH = 318;

  const particles = useRef(
    Array.from({ length: 20 }, (_, i) => ({
      left: Math.random() * 100,
      bottom: Math.random() * 60,
      duration: 4 + Math.random() * 6,
      delay: Math.random() * 8,
      key: i,
    }))
  ).current;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at 50% 40%, #1a0a3a 0%, #0d0520 40%, #060010 100%)",
        fontFamily: "Georgia, serif",
        overflow: "hidden",
        position: "relative",
        padding: "2rem 1rem",
      }}
    >
      <style>{`
        @keyframes dustFloat {
          0% { opacity:0; transform:translateY(0); }
          20% { opacity:0.9; }
          80% { opacity:0.5; }
          100% { opacity:0; transform:translateY(-80px); }
        }
        @keyframes twinkle {
          0%,100% { opacity:0.2; transform:scale(1); }
          50% { opacity:0.9; transform:scale(1.4); }
        }
        @keyframes loadPulse {
          0%,100% { opacity:0.4; }
          50% { opacity:1; }
        }
      `}</style>

      {/* Stars */}
      {Array.from({ length: 55 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "fixed",
            width: i % 5 === 0 ? "3px" : "2px",
            height: i % 5 === 0 ? "3px" : "2px",
            borderRadius: "50%",
            background: i % 7 === 0 ? "#fffad0" : "#d0d8ff",
            left: `${(i * 137.5) % 100}%`,
            top: `${(i * 97.3) % 70}%`,
            animation: `twinkle ${2 + Math.random() * 4}s ${
              Math.random() * 4
            }s infinite`,
            opacity: 0.4,
          }}
        />
      ))}

      {particles.map((p) => (
        <DustParticle key={p.key} style={p} />
      ))}

      {/* Centered column */}
      <div
        style={{
          width: `${TOTAL_WIDTH}px`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.6rem",
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Title */}
        <div style={{ width: "100%", textAlign: "center" }}>
          <div
            style={{
              color: "#e8c96a",
              fontSize: "0.75rem",
              letterSpacing: "0.4em",
              textTransform: "uppercase",
              textShadow: "0 0 20px rgba(255,200,80,0.6)",
              marginBottom: "0.3rem",
            }}
          >
            ✦ A Musical Treasure ✦
          </div>
          <h1
            style={{
              color: "#ffd97a",
              fontSize: "2.1rem",
              margin: 0,
              textShadow:
                "0 0 30px rgba(255,180,50,0.8), 0 0 60px rgba(255,140,0,0.4)",
              fontWeight: "normal",
              letterSpacing: "0.05em",
            }}
          >
            Jet's Music Box
          </h1>
        </div>

        {/* Loading status */}
        {!bothLoaded && (
          <div
            style={{
              color: "rgba(200,160,60,0.7)",
              fontSize: "0.75rem",
              letterSpacing: "0.15em",
              textAlign: "center",
              animation: "loadPulse 1.2s ease-in-out infinite",
            }}
          >
            ♪ Tuning the tines...
            {isLoaded.azizam ? " Azizam ✓" : ""}
            {isLoaded.lovelyday ? " Lovely Day ✓" : ""}
          </div>
        )}

        {/* Song Selector */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            width: "100%",
            boxSizing: "border-box",
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(200,150,50,0.3)",
            borderRadius: "40px",
            padding: "0.6rem 1.4rem",
            backdropFilter: "blur(10px)",
          }}
        >
          <span
            onClick={() => handleSongSwitch("azizam")}
            style={{
              color: song === "azizam" ? "#ffd97a" : "rgba(200,150,80,0.4)",
              fontSize: "0.85rem",
              cursor: "pointer",
              fontStyle: "italic",
              transition: "color 0.4s",
              minWidth: "70px",
              textAlign: "right",
            }}
          >
            Azizam
          </span>
          <div
            onClick={() =>
              handleSongSwitch(song === "azizam" ? "lovelyday" : "azizam")
            }
            style={{
              width: "52px",
              height: "26px",
              borderRadius: "13px",
              flexShrink: 0,
              background: `linear-gradient(135deg, ${
                song === "lovelyday" ? "#8b5e1a" : "#3d1c02"
              }, ${song === "lovelyday" ? "#d4962c" : "#7a3d12"})`,
              border: "2px solid #c8860a",
              cursor: "pointer",
              position: "relative",
              transition: "background 0.4s",
              boxShadow: "0 0 12px rgba(200,130,10,0.4)",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "3px",
                left: song === "lovelyday" ? "26px" : "3px",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #f0c040, #c8860a)",
                transition: "left 0.3s",
                boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
              }}
            />
          </div>
          <span
            onClick={() => handleSongSwitch("lovelyday")}
            style={{
              color: song === "lovelyday" ? "#ffd97a" : "rgba(200,150,80,0.4)",
              fontSize: "0.85rem",
              cursor: "pointer",
              fontStyle: "italic",
              transition: "color 0.4s",
              minWidth: "70px",
              textAlign: "left",
            }}
          >
            Lovely Day
          </span>
        </div>

        {/* Box + Key */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
          }}
        >
          {/* Music Box */}
          <div style={{ width: "240px", flexShrink: 0, position: "relative" }}>
            {/* Outer glow */}
            {isPlaying && (
              <div
                style={{
                  position: "absolute",
                  inset: "-25px",
                  borderRadius: "20px",
                  background: `radial-gradient(ellipse at 50% 60%, rgba(${
                    songData.glow
                  },${glowPulse * 0.45}) 0%, transparent 70%)`,
                  boxShadow: `0 0 ${40 + glowPulse * 40}px rgba(${
                    songData.glow
                  },${glowPulse * 0.5}),
                           0 0 ${80 + glowPulse * 60}px rgba(${songData.glow},${
                    glowPulse * 0.25
                  })`,
                  pointerEvents: "none",
                  zIndex: 0,
                }}
              />
            )}

            {/* Lid */}
            <div
              style={{
                background: `linear-gradient(160deg, ${w.light} 0%, ${w.mid} 40%, ${w.bg} 100%)`,
                borderRadius: "12px 12px 4px 4px",
                height: "55px",
                position: "relative",
                overflow: "hidden",
                boxShadow: `0 -4px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)
                ${
                  isPlaying
                    ? `, 0 0 ${20 + glowPulse * 20}px rgba(${songData.glow},${
                        glowPulse * 0.6
                      })`
                    : ""
                }`,
                border: `1px solid ${w.light}44`,
                zIndex: 3,
              }}
            >
              {[15, 35, 55, 75, 90].map((l) => (
                <div
                  key={l}
                  style={{
                    position: "absolute",
                    left: `${l}%`,
                    top: 0,
                    bottom: 0,
                    width: "1px",
                    background: `linear-gradient(to bottom, transparent, ${w.grain}88, transparent)`,
                    opacity: 0.5,
                  }}
                />
              ))}
              {isPlaying && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: "5%",
                    right: "5%",
                    height: "2px",
                    background: `linear-gradient(to right, transparent, rgba(${songData.glow},${glowPulse}), transparent)`,
                    boxShadow: `0 0 ${10 + glowPulse * 20}px rgba(${
                      songData.glow
                    },${glowPulse})`,
                  }}
                />
              )}
            </div>

            {/* Body */}
            <div
              style={{
                background: `linear-gradient(170deg, ${w.mid} 0%, ${w.bg} 50%, ${w.dark} 100%)`,
                borderRadius: "4px 4px 10px 10px",
                height: "150px",
                position: "relative",
                overflow: "hidden",
                boxShadow: `4px 8px 30px rgba(0,0,0,0.7), -2px 4px 10px rgba(0,0,0,0.4),
                         inset 0 1px 0 rgba(255,255,255,0.08)`,
                border: `1px solid ${w.light}33`,
                zIndex: 2,
              }}
            >
              {[10, 25, 40, 55, 70, 85].map((l) => (
                <div
                  key={l}
                  style={{
                    position: "absolute",
                    left: `${l}%`,
                    top: 0,
                    bottom: 0,
                    width: "1px",
                    background: `linear-gradient(to bottom, transparent 10%, ${w.grain}66 50%, transparent 90%)`,
                    opacity: 0.6,
                  }}
                />
              ))}
              {[30, 60, 90, 120].map((t) => (
                <div
                  key={t}
                  style={{
                    position: "absolute",
                    top: `${t}px`,
                    left: 0,
                    right: 0,
                    height: "1px",
                    background: `linear-gradient(to right, transparent, ${w.grain}44, transparent)`,
                    opacity: 0.4,
                  }}
                />
              ))}

              {/* Brass Plaque */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%,-50%)",
                  width: "180px",
                  background:
                    "linear-gradient(135deg, #c8a840 0%, #f0d060 25%, #a87828 50%, #e8c048 75%, #c09030 100%)",
                  borderRadius: "6px",
                  padding: "10px 14px",
                  boxShadow: `0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,200,0.4),
                  0 0 0 2px #8b6020, 0 0 0 3px #e0b030, 0 0 0 5px #8b6020`,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    color: "#3a1a00",
                    fontSize: "0.55rem",
                    letterSpacing: "0.25em",
                    textTransform: "uppercase",
                    marginBottom: "4px",
                    opacity: 0.8,
                  }}
                >
                  ❧ Est. MMXXIV ❧
                </div>
                <div
                  style={{
                    color: "#2a0e00",
                    fontSize: "1rem",
                    fontWeight: "bold",
                    letterSpacing: "0.05em",
                    textShadow: "0 1px 0 rgba(255,220,100,0.5)",
                    lineHeight: 1.2,
                  }}
                >
                  Jet's
                  <br />
                  Music Box
                </div>
                <div
                  style={{
                    color: "#4a2800",
                    fontSize: "0.5rem",
                    letterSpacing: "0.2em",
                    marginTop: "4px",
                    fontStyle: "italic",
                    opacity: 0.7,
                  }}
                >
                  ~ {songData.name} ~
                </div>
              </div>
            </div>

            {/* Feet */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "0 10px",
                position: "relative",
                zIndex: 2,
              }}
            >
              {[0, 1].map((i) => (
                <div
                  key={i}
                  style={{
                    width: "30px",
                    height: "10px",
                    background: `linear-gradient(to bottom, ${w.bg}, ${w.dark})`,
                    borderRadius: "0 0 6px 6px",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.6)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Winding Key */}
          <div
            style={{
              width: "70px",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "12px",
                height: "30px",
                background:
                  "linear-gradient(to right, #9a7a30, #f0c040, #9a7a30)",
                borderRadius: "3px",
                boxShadow: "2px 2px 6px rgba(0,0,0,0.5)",
              }}
            />
            <div
              ref={keyRef}
              onMouseDown={onKeyMouseDown}
              onTouchStart={onKeyMouseDown}
              style={{
                width: "46px",
                height: "46px",
                background:
                  "linear-gradient(135deg, #c8a030, #f5d050, #a07820, #e8b838)",
                borderRadius: "50%",
                border: "3px solid #8b6010",
                cursor: isDragging ? "grabbing" : "grab",
                transform: `rotate(${keyAngle}deg)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow:
                  "0 4px 15px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,240,150,0.5)",
                userSelect: "none",
                WebkitUserSelect: "none",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  width: "60%",
                  height: "4px",
                  background: "#7a5010",
                  borderRadius: "2px",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  width: "4px",
                  height: "60%",
                  background: "#7a5010",
                  borderRadius: "2px",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  width: "8px",
                  height: "8px",
                  background: "radial-gradient(circle, #f0d060, #a07820)",
                  borderRadius: "50%",
                  border: "1px solid #7a5010",
                }}
              />
            </div>
            <div
              style={{
                marginTop: "8px",
                color: "rgba(200,160,60,0.7)",
                fontSize: "0.55rem",
                textAlign: "center",
                letterSpacing: "0.08em",
                lineHeight: 1.3,
              }}
            >
              {isDragging ? "WINDING" : "DRAG TO"}
              <br />
              {isDragging ? "" : "WIND"}
            </div>
          </div>
        </div>

        {/* Status */}
        <div
          style={{
            width: "100%",
            textAlign: "center",
            color: "rgba(180,140,60,0.7)",
            fontSize: "0.75rem",
            letterSpacing: "0.15em",
            fontStyle: "italic",
            minHeight: "1.2em",
          }}
        >
          {!bothLoaded
            ? "♪ Tuning the tines..."
            : isPlaying
            ? `♪ Playing ${songData.name}... ♪`
            : "Wind the key clockwise to play"}
        </div>

        {/* Credit */}
        <div
          style={{
            width: "100%",
            textAlign: "center",
            color: "rgba(160,120,50,0.45)",
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            fontStyle: "italic",
            marginTop: "-0.8rem",
          }}
        >
          Created by: Cha
        </div>
      </div>
    </div>
  );
}
