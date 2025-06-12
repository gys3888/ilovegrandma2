// src/App.tsx
import React, { useState, useEffect, useRef } from "react";

// 전역 window 타입 확장
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Web Speech API 호환 처리
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
let recognition: any = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true; // 연속 인식
  recognition.lang = "ko-KR"; // 한국어
  recognition.interimResults = true; // 중간 결과 허용
}

// 글자 크기를 컨테이너에 맞춰 자동 조절하는 훅
const useFitText = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fontSize, setFontSize] = useState(100);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    const resizeObserver = new ResizeObserver(() => {
      if (!el.parentElement) return;
      const parent = el.parentElement;
      let currentFontSize = 150;
      el.style.fontSize = `${currentFontSize}px`;

      while (
        (el.scrollWidth > parent.clientWidth ||
          el.scrollHeight > parent.clientHeight) &&
        currentFontSize > 10
      ) {
        currentFontSize--;
        el.style.fontSize = `${currentFontSize}px`;
      }
      setFontSize(currentFontSize);
    });

    resizeObserver.observe(el);
    if (el.parentElement) resizeObserver.observe(el.parentElement);
    return () => resizeObserver.disconnect();
  }, []);

  return { ref, style: { fontSize: `${fontSize}px` } };
};

type FullScreenTextViewerProps = { text: string };
const FullScreenTextViewer: React.FC<FullScreenTextViewerProps> = ({
  text,
}) => {
  const { ref, style } = useFitText();
  return (
    <div className="flex-grow w-full flex items-center justify-center p-4 overflow-hidden">
      <div
        ref={ref}
        style={style}
        className="font-bold text-center leading-tight whitespace-normal break-words"
      >
        {text || "마이크 버튼을 누르고 말씀하세요"}
      </div>
    </div>
  );
};

interface Message {
  text: string;
  timestamp: number;
}
type ConversationHistoryProps = { messages: Message[] };
const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  messages,
}) => {
  const historyEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto h-48 md:h-64 bg-gray-700/50 rounded-lg p-4 overflow-y-auto custom-scrollbar">
      <ul className="space-y-3">
        {messages.map((msg) => (
          <li key={msg.timestamp} className="flex flex-col">
            <span className="text-sm text-gray-400">
              {new Date(msg.timestamp).toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <p className="text-xl md:text-2xl text-white">{msg.text}</p>
          </li>
        ))}
      </ul>
      <div ref={historyEndRef} />
    </div>
  );
};

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [latestTranscript, setLatestTranscript] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!recognition) {
      setError(
        "이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Safari 최신 버전을 사용해주세요."
      );
      return;
    }

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setLatestTranscript(finalTranscript + interimTranscript);
    };

    recognition.onend = () => {
      setIsListening(false);
      setLatestTranscript((prev) => {
        if (prev.trim()) {
          setMessages((msgs) => [
            ...msgs,
            { text: prev.trim(), timestamp: Date.now() },
          ]);
        }
        return "";
      });
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        setError("음성이 감지되지 않았습니다. 다시 시도해주세요.");
      } else {
        setError(`음성 인식 오류: ${event.error}`);
      }
      setIsListening(false);
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognition.stop();
    } else {
      setError("");
      setLatestTranscript("");
      recognition.start();
    }
    setIsListening(!isListening);
  };

  return (
    <div className="bg-gray-900 text-white h-screen flex flex-col font-sans">
      <header className="text-center p-4">
        <h1 className="text-2xl font-semibold">👵 할머니 필담 도우미</h1>
      </header>

      <main className="flex-grow w-full flex flex-col items-center justify-center overflow-hidden">
        <FullScreenTextViewer text={latestTranscript} />
        <div className="w-full p-4">
          <ConversationHistory messages={messages} />
        </div>
        {error && <p className="text-red-400 text-center my-2">{error}</p>}
      </main>

      <footer className="p-4 w-full relative">
        {isListening && (
          <div className="absolute bottom-0 left-0 w-full h-full border-8 border-green-500 rounded-lg animate-pulse pointer-events-none"></div>
        )}
        <button
          onClick={toggleListening}
          className={`w-full max-w-md mx-auto py-6 px-6 text-3xl font-bold rounded-xl transition duration-300 ease-in-out transform active:scale-95 flex items-center justify-center ${
            isListening
              ? "bg-gray-600 hover:bg-gray-700"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isListening ? (
            <>
              <svg
                className="animate-spin h-8 w-8 mr-3 text-white"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>대화 듣는 중...</span>
            </>
          ) : (
            "🎤 대화 시작"
          )}
        </button>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #374151; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #10B981; border-radius: 4px; }
      `}</style>
    </div>
  );
}
