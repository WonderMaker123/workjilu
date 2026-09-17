// 语音输入：基于浏览器 Web Speech API（Chrome / Edge / Android 浏览器支持较好）
// 中文识别，连续模式 + 临时结果；静音自动断句时自动重启，直到用户手动停止

interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
interface SpeechErrorEvent { error: string; }
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
}

export interface SpeechSession {
  start: () => void;
  stop: () => void;
  onFinal: ((text: string) => void) | null;
  onInterim: ((text: string) => void) | null;
  onStateChange: ((active: boolean) => void) | null;
  onError: ((message: string) => void) | null;
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function createSpeechSession(): SpeechSession | null {
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;

  let recognition: RecognitionLike | null = null;
  let wantActive = false; // 用户期望的状态（区分手动停止与静音断句）
  let restartTimer: number | undefined;

  const api: SpeechSession = {
    start: () => {
      if (wantActive) return;
      wantActive = true;
      begin();
      api.onStateChange?.(true);
    },
    stop: () => {
      wantActive = false;
      if (restartTimer) { window.clearTimeout(restartTimer); restartTimer = undefined; }
      try { recognition?.stop(); } catch { /* 未启动时忽略 */ }
      api.onInterim?.('');
      api.onStateChange?.(false);
    },
    onFinal: null,
    onInterim: null,
    onStateChange: null,
    onError: null,
  };

  function begin() {
    const r: RecognitionLike = new Ctor();
    r.lang = 'zh-CN';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i] as any;
        const transcript: string = result[0]?.transcript || '';
        if (result.isFinal) api.onFinal?.(transcript);
        else interim += transcript;
      }
      api.onInterim?.(interim);
    };

    r.onerror = (e) => {
      // not-allowed：麦克风权限被拒；no-speech：静音，交给 onend 自动重启
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantActive = false;
        api.onError?.('麦克风权限被拒绝，请在浏览器设置中允许');
        api.onStateChange?.(false);
      } else if (e.error === 'network') {
        wantActive = false;
        api.onError?.('语音服务网络异常，请检查网络后重试');
        api.onStateChange?.(false);
      }
      // audio-capture / no-speech / aborted 等错误静默，由 onend 决定是否重启
    };

    r.onend = () => {
      api.onInterim?.('');
      // 用户仍想录音（静音断句/浏览器自动停止）→ 延迟重启
      if (wantActive) {
        restartTimer = window.setTimeout(() => {
          if (wantActive) begin();
        }, 250);
      }
    };

    recognition = r;
    try { r.start(); } catch { /* 重复 start 忽略，onend 会重启 */ }
  }

  return api;
}
