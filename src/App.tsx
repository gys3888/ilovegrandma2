import React, { useState, useEffect, useRef } from "react";

// Web Speech API를 위한 인터페이스 정의 (브라우저 호환성)
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true; // 연속적인 음성 인식
  recognition.lang = "ko-KR"; // 한국어 설정
  recognition.interimResults = true; // 중간 결과 표시
}

// 동적으로 폰트 크기를 조절하는 커스텀 훅
const useFitText = () => {
  const ref = useRef(null);
  const [fontSize, setFontSize] = useState(100); // 초기 폰트 크기

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (!ref.current || !ref.current.parentElement) return;

      const parent = ref.current.parentElement;
      const parentWidth = parent.clientWidth;
      const parentHeight = parent.clientHeight;

      let currentFontSize = 150; // 최대 폰트 크기부터 시작
      ref.current.style.fontSize = `${currentFontSize}px`;

      // 텍스트가 부모 요소를 넘치지 않을 때까지 폰트 크기를 줄임
      while (
        (ref.current.scrollWidth > parentWidth ||
          ref.current.scrollHeight > parentHeight) &&
        currentFontSize > 10 // 최소 폰트 크기
      ) {
        currentFontSize--;
        ref.current.style.fontSize = `${currentFontSize}px`;
      }
      setFontSize(currentFontSize);
    });

    if (ref.current) {
      resizeObserver.observe(ref.current);
      resizeObserver.observe(ref.current.parentElement);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [ref]);

  return { ref, style: { fontSize: `${fontSize}px` } };
};

// 최신 메시지를 전체 화면으로 보여주는 컴포넌트
const FullScreenTextViewer = ({ text }) => {
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

// 대화 기록을 표시하는 컴포넌트
const ConversationHistory = ({ messages }) => {
  const historyEndRef = useRef(null);

  useEffect(() => {
    // 새 메시지가 추가되면 맨 아래로 스크롤
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

// 메인 앱 컴포넌트
export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [latestTranscript, setLatestTranscript] = useState("");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");

  // 음성 인식 이벤트 핸들러 설정
  useEffect(() => {
    if (!recognition) {
      setError(
        "이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Safari 최신 버전을 사용해주세요."
      );
      return;
    }

    // 음성 인식 결과가 나올 때마다 호출
    recognition.onresult = (event) => {
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

    // 음성 인식이 종료될 때 호출
    recognition.onend = () => {
      setIsListening(false);
      // 최종 텍스트가 있을 경우 메시지 목록에 추가
      setLatestTranscript((prev) => {
        if (prev.trim()) {
          setMessages((currentMessages) => [
            ...currentMessages,
            { text: prev.trim(), timestamp: Date.now() },
          ]);
        }
        return ""; // 현재 텍스트 초기화
      });
    };

    // 에러 처리
    recognition.onerror = (event) => {
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

      <footer className="p-4 w-full">
        {/* 녹음 중 시각적 피드백 */}
        {isListening && (
          <div className="absolute bottom-0 left-0 w-full h-full border-8 border-green-500 rounded-lg box-border animate-pulse pointer-events-none"></div>
        )}
        <button
          onClick={toggleListening}
          className={`w-full max-w-md mx-auto py-6 px-6 text-3xl font-bold rounded-xl transition-all duration-300 ease-in-out transform active:scale-95 flex items-center justify-center
            ${
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
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>대화 듣는 중...</span>
            </>
          ) : (
            "🎤 대화 시작"
          )}
        </button>
      </footer>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #374151; /* bg-gray-700 */
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #10B981; /* bg-green-500 */
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
