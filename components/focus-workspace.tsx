'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Clock3,
  Cloud,
  Maximize2,
  Minimize2,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Sun,
  Timer,
  Trees,
  Waves,
} from 'lucide-react';
import styles from './focus-workspace.module.css';

type TimerMode = 'focus' | 'short' | 'long';
type FocusView = 'ambient' | 'clock' | 'timer';
type FocusTheme = 'light' | 'dark';
type DayScene = 'sea' | 'wind' | 'sky';

const DAY_SCENES: {
  id: DayScene;
  label: string;
  detail: string;
  icon: typeof Waves;
  src: string;
}[] = [
  {
    id: 'sea',
    label: 'Sea',
    detail: 'Still water',
    icon: Waves,
    src: 'https://assets.mixkit.co/videos/20248/20248-720.mp4',
  },
  {
    id: 'wind',
    label: 'Wind',
    detail: 'Meadow air',
    icon: Trees,
    src: 'https://assets.mixkit.co/videos/30602/30602-720.mp4',
  },
  {
    id: 'sky',
    label: 'Sky',
    detail: 'Above clouds',
    icon: Cloud,
    src: 'https://assets.mixkit.co/videos/32991/32991-720.mp4',
  },
];

const NIGHT_SCENE = 'https://assets.mixkit.co/videos/26956/26956-720.mp4';

const TIMER_MODES: { id: TimerMode; label: string; minutes: number }[] = [
  { id: 'focus', label: 'Focus', minutes: 25 },
  { id: 'short', label: 'Short break', minutes: 5 },
  { id: 'long', label: 'Long break', minutes: 15 },
];

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function PaperShader({ theme }: { theme: FocusTheme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      powerPreference: 'low-power',
    });
    if (!gl) return;

    const vertexShader = compileShader(
      gl,
      gl.VERTEX_SHADER,
      `
        attribute vec2 a_position;
        void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `
    );
    const fragmentShader = compileShader(
      gl,
      gl.FRAGMENT_SHADER,
      `
        #define LIGHT_MODE ${theme === 'light' ? '1' : '0'}
        precision highp float;
        uniform vec2 u_resolution;
        uniform float u_time;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float glow(vec2 p, vec2 center, vec2 stretch, float softness) {
          vec2 q = (p - center) * stretch;
          return exp(-dot(q, q) * softness);
        }

        void main() {
          vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
          float phase = mod(u_time, 28.0) / 28.0 * 6.28318530718;

          vec2 centerA = vec2(
            -0.34 + cos(phase) * 0.48,
             0.15 + sin(phase) * 0.27
          );
          vec2 centerB = vec2(
             0.36 + cos(phase + 2.094) * 0.42,
            -0.2 + sin(phase + 2.094) * 0.3
          );
          vec2 centerC = vec2(
             0.02 + cos(phase + 4.188) * 0.5,
             0.46 + sin(phase + 4.188) * 0.23
          );

          float fieldA = glow(p, centerA, vec2(0.72, 1.08), 1.85);
          float fieldB = glow(p, centerB, vec2(0.8, 0.95), 1.95);
          float fieldC = glow(p, centerC, vec2(0.88, 1.2), 2.1);
          float meeting = fieldA * fieldB + fieldB * fieldC + fieldC * fieldA;
          float glassEdge = smoothstep(0.045, 0.0, abs(fieldA + fieldB * 0.72 - 0.82));
          float lightSheet = 0.5 + 0.5 * sin(p.x * 1.25 - p.y * 0.72 + phase);
          float breath = 0.94 + 0.06 * sin(phase);

          vec3 color;
          #if LIGHT_MODE == 1
            vec3 stone = vec3(0.95, 0.95, 0.93);
            vec3 mist = vec3(0.86, 0.86, 0.84);
            vec3 sage = vec3(0.82, 0.82, 0.80);
            vec3 blush = vec3(0.90, 0.89, 0.87);
            color = stone;
            color = mix(color, mist, fieldA * 0.32);
            color = mix(color, sage, fieldB * 0.24);
            color = mix(color, blush, fieldC * 0.17);
            color += vec3(0.12, 0.115, 0.1) * meeting * 0.12;
            color += vec3(0.09, 0.09, 0.085) * glassEdge;
            color = mix(color, vec3(0.9, 0.89, 0.85), lightSheet * 0.09);
          #else
            vec3 night = vec3(0.10, 0.10, 0.098);
            vec3 blue = vec3(0.15, 0.15, 0.145);
            vec3 teal = vec3(0.21, 0.21, 0.20);
            vec3 plum = vec3(0.17, 0.17, 0.165);
            color = night;
            color = mix(color, blue, fieldA * 0.68);
            color = mix(color, teal, fieldB * 0.52);
            color = mix(color, plum, fieldC * 0.43);
            color += vec3(0.075, 0.075, 0.07) * meeting * 0.3;
            color += vec3(0.04, 0.04, 0.035) * glassEdge;
            color = mix(color, vec3(0.075, 0.075, 0.07), lightSheet * 0.13);
          #endif
          color *= breath;

          float grain = hash(gl_FragCoord.xy);
          color += (grain - 0.5) * 0.004;

          float vignette = smoothstep(1.15, 0.25, length(p));
          color *= 0.95 + vignette * 0.05;
          gl_FragColor = vec4(color, 1.0);
        }
      `
    );

    if (!vertexShader || !fragmentShader) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const buffer = gl.createBuffer();
    const position = gl.getAttribLocation(program, 'a_position');
    const resolution = gl.getUniformLocation(program, 'u_resolution');
    const time = gl.getUniformLocation(program, 'u_time');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.useProgram(program);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const motionRate = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.25 : 1;
    let frame = 0;
    const startedAt = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const width = Math.round(canvas.clientWidth * dpr);
      const height = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const render = (now: number) => {
      resize();
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, ((now - startedAt) / 1000) * motionRate);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame = requestAnimationFrame(render);
    };

    render(startedAt);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [theme]);

  return <canvas ref={canvasRef} className={styles.shader} aria-hidden="true" />;
}

function NatureBackdrop({
  theme,
  scene,
  onReady,
}: {
  theme: FocusTheme;
  scene: DayScene;
  onReady: () => void;
}) {
  const [ready, setReady] = useState(false);
  const dayVideo = DAY_SCENES.find((item) => item.id === scene) ?? DAY_SCENES[0];
  const src = theme === 'dark' ? NIGHT_SCENE : dayVideo.src;

  return (
    <>
      <PaperShader theme={theme} />
      <video
        className={`${styles.natureVideo} ${ready ? styles.natureVideoReady : ''}`}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onCanPlay={() => {
          setReady(true);
          onReady();
        }}
        aria-hidden="true"
      />
      <div className={styles.videoGrade} aria-hidden="true" />
    </>
  );
}

function SplitFlap({ value, compact = false }: { value: string; compact?: boolean }) {
  return (
    <div className={`${styles.splitFlap} ${compact ? styles.splitFlapCompact : ''}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className={styles.splitFlapValue}
          initial={{ rotateX: -48, opacity: 0.45 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 48, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
      <span className={styles.splitFlapSeam} aria-hidden="true" />
      <span className={`${styles.splitFlapPin} ${styles.splitFlapPinLeft}`} aria-hidden="true" />
      <span className={`${styles.splitFlapPin} ${styles.splitFlapPinRight}`} aria-hidden="true" />
    </div>
  );
}

function FlipClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const update = () => setNow(new Date());
    const delay = 1000 - (Date.now() % 1000);
    let interval = 0;
    const timeout = window.setTimeout(() => {
      update();
      interval = window.setInterval(update, 1000);
    }, delay);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(now);

  return (
    <section className={styles.clockBlock} aria-label={`Local time ${hours}:${minutes}:${seconds}`}>
      <div className={styles.clockMeta}>
        <span>Local time</span>
        <span>{dateLabel}</span>
      </div>
      <div className={styles.clockDigits} aria-hidden="true">
        <SplitFlap value={hours} />
        <SplitFlap value={minutes} />
      </div>
      <p className={styles.clockSeconds}>{seconds} seconds</p>
    </section>
  );
}

export function FocusWorkspace() {
  const [theme, setTheme] = useState<FocusTheme>('dark');
  const [view, setView] = useState<FocusView>('ambient');
  const [dayScene, setDayScene] = useState<DayScene>('sea');
  const [chromeVisible, setChromeVisible] = useState(true);
  const [mode, setMode] = useState<TimerMode>('focus');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [backdropTransition, setBackdropTransition] = useState<{
    label: string;
    detail: string;
    theme: FocusTheme;
    token: number;
  } | null>(null);
  const endTimeRef = useRef<number | null>(null);
  const backdropSwapTimeoutRef = useRef(0);
  const backdropReleaseTimeoutRef = useRef(0);

  const selectedMode = useMemo(
    () => TIMER_MODES.find((item) => item.id === mode) ?? TIMER_MODES[0],
    [mode]
  );
  const totalSeconds = selectedMode.minutes * 60;
  const progress = 1 - secondsLeft / totalSeconds;

  useEffect(() => {
    const saved = window.localStorage.getItem('mono-focus-theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
      return;
    }
    setTheme(window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  }, []);

  useEffect(() => {
    if (view !== 'ambient') {
      setChromeVisible(true);
      return;
    }

    let timeout = 0;
    const revealChrome = () => {
      setChromeVisible(true);
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setChromeVisible(false), 3200);
    };

    revealChrome();
    window.addEventListener('pointermove', revealChrome);
    window.addEventListener('pointerdown', revealChrome);
    window.addEventListener('keydown', revealChrome);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('pointermove', revealChrome);
      window.removeEventListener('pointerdown', revealChrome);
      window.removeEventListener('keydown', revealChrome);
    };
  }, [view]);

  useEffect(
    () => () => {
      window.clearTimeout(backdropSwapTimeoutRef.current);
      window.clearTimeout(backdropReleaseTimeoutRef.current);
    },
    []
  );

  const transitionBackdrop = useCallback(
    (nextTheme: FocusTheme, nextScene: DayScene) => {
      const scene = DAY_SCENES.find((item) => item.id === nextScene) ?? DAY_SCENES[0];
      const label = nextTheme === 'dark' ? 'Moon forest' : scene.label;
      const detail = nextTheme === 'dark' ? 'Quiet night' : scene.detail;

      window.clearTimeout(backdropSwapTimeoutRef.current);
      window.clearTimeout(backdropReleaseTimeoutRef.current);
      setBackdropTransition({ label, detail, theme: nextTheme, token: Date.now() });

      backdropSwapTimeoutRef.current = window.setTimeout(() => {
        setTheme(nextTheme);
        setDayScene(nextScene);
        window.localStorage.setItem('mono-focus-theme', nextTheme);
        backdropReleaseTimeoutRef.current = window.setTimeout(
          () => setBackdropTransition(null),
          2400
        );
      }, 300);
    },
    []
  );

  const releaseBackdropTransition = useCallback(() => {
    window.clearTimeout(backdropReleaseTimeoutRef.current);
    backdropReleaseTimeoutRef.current = window.setTimeout(
      () => setBackdropTransition(null),
      180
    );
  }, []);

  const toggleFocusTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    if (view === 'ambient') {
      transitionBackdrop(next, dayScene);
      return;
    }
    window.localStorage.setItem('mono-focus-theme', next);
    setTheme(next);
  };

  const chooseDayScene = (nextScene: DayScene) => {
    if (nextScene === dayScene || backdropTransition) return;
    transitionBackdrop('light', nextScene);
  };

  const reset = useCallback(() => {
    setRunning(false);
    endTimeRef.current = null;
    setSecondsLeft(selectedMode.minutes * 60);
  }, [selectedMode.minutes]);

  const toggleRunning = useCallback(() => {
    setRunning((wasRunning) => {
      if (!wasRunning) {
        const nextDuration = secondsLeft === 0 ? totalSeconds : secondsLeft;
        if (secondsLeft === 0) setSecondsLeft(nextDuration);
        endTimeRef.current = Date.now() + nextDuration * 1000;
      } else {
        endTimeRef.current = null;
      }
      return !wasRunning;
    });
  }, [secondsLeft, totalSeconds]);

  const chooseMode = useCallback((nextMode: TimerMode) => {
    const next = TIMER_MODES.find((item) => item.id === nextMode) ?? TIMER_MODES[0];
    setMode(nextMode);
    setRunning(false);
    endTimeRef.current = null;
    setSecondsLeft(next.minutes * 60);
  }, []);

  const chooseView = useCallback((nextView: FocusView) => {
    setView(nextView);
    if (nextView !== 'timer') {
      setRunning(false);
      endTimeRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const end = endTimeRef.current;
      if (!end) return;
      const next = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSecondsLeft(next);
      if (next === 0) {
        setRunning(false);
        endTimeRef.current = null;
        if (mode === 'focus') setSessions((count) => count + 1);
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [mode, running]);

  useEffect(() => {
    const originalTitle = document.title;
    if (view === 'timer') {
      const minutes = Math.floor(secondsLeft / 60);
      const seconds = secondsLeft % 60;
      document.title = `${minutes}:${String(seconds).padStart(2, '0')} · ${selectedMode.label}`;
    } else {
      document.title = view === 'clock' ? 'Flip clock · mono' : 'Ambient paper · mono';
    }
    return () => {
      document.title = originalTitle;
    };
  }, [secondsLeft, selectedMode.label, view]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    const onKeyDown = (event: KeyboardEvent) => {
      if (view !== 'timer') return;
      if (event.target instanceof HTMLElement && event.target.isContentEditable) return;
      if (event.code === 'Space') {
        event.preventDefault();
        toggleRunning();
      }
      if (event.key.toLowerCase() === 'r') reset();
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [reset, toggleRunning, view]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen can be blocked by browser or embedding policy.
    }
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <main
      className={`${styles.workspace} ${theme === 'light' ? styles.light : styles.dark} ${
        view === 'ambient' && !chromeVisible ? styles.ambientIdle : ''
      }`}
    >
      {view === 'ambient' && (
        <NatureBackdrop
          key={`${theme}-${dayScene}`}
          theme={theme}
          scene={dayScene}
          onReady={releaseBackdropTransition}
        />
      )}
      <div className={styles.paperOverlay} aria-hidden="true" />

      <AnimatePresence>
        {backdropTransition && (
          <motion.div
            key={backdropTransition.token}
            className={`${styles.sceneTransition} ${
              backdropTransition.theme === 'light'
                ? styles.sceneTransitionLight
                : styles.sceneTransitionDark
            }`}
            initial={{ clipPath: 'inset(100% 0 0 0)' }}
            animate={{ clipPath: 'inset(0% 0 0 0)' }}
            exit={{ clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.34, ease: [0.76, 0, 0.24, 1] }}
            aria-live="polite"
          >
            <div className={styles.transitionIndex}>
              <span>Ambient / scene</span>
              <span>Loop film</span>
            </div>
            <div className={styles.transitionTitle}>
              <span>{backdropTransition.detail}</span>
              <strong>{backdropTransition.label}</strong>
            </div>
            <div className={styles.transitionTrack}>
              <span />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className={styles.topbar}>
        <Link className={styles.utilityButton} href="/" aria-label="Back to mono tools">
          <ArrowLeft size={16} />
          <span>mono</span>
        </Link>
        <div className={styles.viewTabs} aria-label="Focus room view">
          <button
            type="button"
            className={view === 'ambient' ? styles.viewActive : ''}
            onClick={() => chooseView('ambient')}
          >
            <Sparkles size={13} />
            <span>Ambient</span>
          </button>
          <button
            type="button"
            className={view === 'clock' ? styles.viewActive : ''}
            onClick={() => chooseView('clock')}
          >
            <Clock3 size={13} />
            <span>Clock</span>
          </button>
          <button
            type="button"
            className={view === 'timer' ? styles.viewActive : ''}
            onClick={() => chooseView('timer')}
          >
            <Timer size={13} />
            <span>Pomodoro</span>
          </button>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.iconButton}
            type="button"
            onClick={toggleFocusTheme}
            aria-label={`Use ${theme === 'dark' ? 'day' : 'night'} scene`}
            title={theme === 'dark' ? 'Day nature' : 'Starry night'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            className={styles.iconButton}
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </header>

      <div className={styles.content}>
        {view === 'clock' && <FlipClock />}

        {view === 'timer' && (
          <section className={styles.timerPanel} aria-label="Pomodoro timer">
            <div className={styles.timerHeader}>
              <div className={styles.modeTabs}>
                {TIMER_MODES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.id === mode ? styles.modeActive : ''}
                    onClick={() => chooseMode(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <span className={styles.timerStatus}>
                {running ? 'In focus' : secondsLeft === 0 ? 'Complete' : 'Ready'}
              </span>
            </div>

            <time className={styles.timerReadout} dateTime={`PT${secondsLeft}S`}>
              <div className={styles.timerFlapGroup}>
                <SplitFlap value={String(minutes).padStart(2, '0')} compact />
                <span>Minutes</span>
              </div>
              <span className={styles.timerColon} aria-hidden="true">:</span>
              <div className={styles.timerFlapGroup}>
                <SplitFlap value={String(seconds).padStart(2, '0')} compact />
                <span>Seconds</span>
              </div>
            </time>

            <div className={styles.timerProgress} aria-hidden="true">
              <span style={{ width: `${Math.max(0, progress) * 100}%` }} />
            </div>

            <div className={styles.timerFooter}>
              <div className={styles.sessionRow}>
                <span>Sessions</span>
                <div aria-label={`${sessions} completed focus sessions`}>
                  {[0, 1, 2, 3].map((index) => (
                    <span key={index} className={index < sessions % 4 || (sessions > 0 && sessions % 4 === 0) ? styles.sessionDone : ''}>
                      {index < sessions % 4 || (sessions > 0 && sessions % 4 === 0) ? <Check size={10} /> : null}
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.timerControls}>
                <button type="button" className={styles.secondaryControl} onClick={reset} aria-label="Reset timer">
                  <RotateCcw size={17} />
                </button>
                <button type="button" className={styles.primaryControl} onClick={toggleRunning}>
                  {running ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                  <span>{running ? 'Pause' : secondsLeft === 0 ? 'Start again' : 'Start focus'}</span>
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      {view === 'ambient' && theme === 'light' && (
        <nav className={styles.scenePicker} aria-label="Daylight scene">
          <div className={styles.sceneIdentity}>
            <span>Daylight</span>
            <strong>
              {(DAY_SCENES.find((item) => item.id === dayScene) ?? DAY_SCENES[0]).detail}
            </strong>
          </div>
          <div className={styles.sceneOptions}>
            {DAY_SCENES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={dayScene === item.id ? styles.sceneActive : ''}
                  onClick={() => chooseDayScene(item.id)}
                  aria-pressed={dayScene === item.id}
                >
                  <span className={styles.sceneIcon}>
                    <Icon size={14} />
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {view === 'timer' && (
        <footer className={styles.shortcuts}>
          <span><kbd>Space</kbd> start / pause</span>
          <span><kbd>R</kbd> reset</span>
        </footer>
      )}
    </main>
  );
}
