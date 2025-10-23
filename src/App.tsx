import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';

// Speech Recognition interface
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

function App() {
  const [selectedRole, setSelectedRole] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dailyProgress, setDailyProgress] = useState(0);
  const [messages, setMessages] = useState<Array<{ role: string; content: string; icon: string; feedback?: string; correctedResponse?: string }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scenario, setScenario] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [voiceVolume, setVoiceVolume] = useState(0.8);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize speech recognition and text-to-speech
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Speech Recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = false;
        recognitionInstance.interimResults = false;
        recognitionInstance.lang = 'en-US';

        recognitionInstance.onstart = () => {
          setIsRecording(true);
        };

        recognitionInstance.onend = () => {
          setIsRecording(false);
        };

        recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          setInputValue(transcript);
          // Auto-submit the voice input after a short delay
          setTimeout(() => {
            handleSubmit({ preventDefault: () => {} } as React.FormEvent);
            stopRecording();
          }, 100);
        };

        recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          setIsRecording(false);
          // Show user-friendly error message
          let errorMessage = 'Microphone access denied or not available. ';
          switch (event.error) {
            case 'not-allowed':
              errorMessage += 'Please allow microphone access in your browser settings.';
              break;
            case 'no-speech':
              errorMessage += 'No speech was detected. Please speak clearly into the microphone.';
              break;
            case 'audio-capture':
              errorMessage += 'Microphone is not available or is being used by another application.';
              break;
            case 'network':
              errorMessage += 'Network error occurred. Please check your internet connection.';
              break;
            default:
              errorMessage += 'Please check your browser settings and allow microphone access.';
          }
          alert(errorMessage);
        };

        setRecognition(recognitionInstance);
      } else {
        console.warn('Speech recognition not supported in this browser');
      }

      // Text-to-Speech
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        setAvailableVoices(voices);
        if (voices.length > 0 && !selectedVoice) {
          // Select a default English voice
          const englishVoice = voices.find(voice => voice.lang.startsWith('en')) || voices[0];
          setSelectedVoice(englishVoice.name);
        }
      };

      loadVoices();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, [selectedVoice]);

  const startRecording = async () => {
    if (recognition && !isRecording) {
      try {
        // Request microphone permission first
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream immediately after permission is granted
        stream.getTracks().forEach(track => track.stop());
        recognition.start();
      } catch (error) {
        console.error('Microphone permission denied:', error);
        alert('Microphone access is required for voice input. Please allow microphone access in your browser settings.');
      }
    }
  };

  const stopRecording = () => {
    if (recognition && isRecording) {
      recognition.stop();
    }
  };

  const speakText = (text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;

    // Stop any current speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voiceSpeed;
    utterance.volume = voiceVolume;

    // Set the selected voice
    if (selectedVoice && availableVoices.length > 0) {
      const voice = availableVoices.find(v => v.name === selectedVoice);
      if (voice) {
        utterance.voice = voice;
      }
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const roles = [
    { id: 'developer', name: 'Developer', icon: '💻', gradient: 'from-blue-400 to-cyan-400', hover: 'hover:from-blue-500 hover:to-cyan-500', shadow: 'hover:shadow-blue-200/50' },
    { id: 'data-analyst', name: 'Data Analyst', icon: '📊', gradient: 'from-emerald-400 to-teal-400', hover: 'hover:from-emerald-500 hover:to-teal-500', shadow: 'hover:shadow-emerald-200/50' },
    { id: 'product-manager', name: 'Product Manager', icon: '🎯', gradient: 'from-violet-400 to-fuchsia-400', hover: 'hover:from-violet-500 hover:to-fuchsia-500', shadow: 'hover:shadow-violet-200/50' },
    { id: 'ux-designer', name: 'UX Designer', icon: '🎨', gradient: 'from-orange-400 to-red-400', hover: 'hover:from-orange-500 hover:to-red-500', shadow: 'hover:shadow-orange-200/50' },
    { id: 'software-engineer', name: 'Software Engineer', icon: '⚙️', gradient: 'from-rose-400 to-pink-400', hover: 'hover:from-rose-500 hover:to-pink-500', shadow: 'hover:shadow-rose-200/50' },
    { id: 'data-scientist', name: 'Data Scientist', icon: '🧠', gradient: 'from-amber-400 to-yellow-400', hover: 'hover:from-amber-500 hover:to-yellow-500', shadow: 'hover:shadow-amber-200/50' },
    { id: 'marketing-manager', name: 'Marketing Manager', icon: '📢', gradient: 'from-fuchsia-400 to-violet-400', hover: 'hover:from-fuchsia-500 hover:to-violet-500', shadow: 'hover:shadow-fuchsia-200/50' },
    { id: 'sales-representative', name: 'Sales Rep', icon: '💼', gradient: 'from-indigo-400 to-blue-400', hover: 'hover:from-indigo-500 hover:to-blue-500', shadow: 'hover:shadow-indigo-200/50' },
    { id: 'hr-specialist', name: 'HR Specialist', icon: '👥', gradient: 'from-lime-400 to-green-400', hover: 'hover:from-lime-500 hover:to-green-500', shadow: 'hover:shadow-lime-200/50' },
    { id: 'project-manager', name: 'Project Manager', icon: '📋', gradient: 'from-sky-400 to-cyan-400', hover: 'hover:from-sky-500 hover:to-cyan-500', shadow: 'hover:shadow-sky-200/50' },
  ];

  const handleRoleSelect = async (roleId: string) => {
    setSelectedRole(roleId);
    setShowChat(true);
    setIsLoading(true);

    try {
      // Mock session for testing - comment out database operations
      const mockSessionId = `mock-${Date.now()}`;
      setSessionId(mockSessionId);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-communication-coach`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: roleId }),
      });

      const data = await response.json();

      setScenario(data.scenario || 'Practice your professional communication skills in a realistic workplace scenario.');
      setMessages([{ role: 'ai', content: data.message, icon: '🤖' }]);

      // Speak the scenario and initial AI message if voice is enabled
      if (voiceEnabled) {
        if (data.scenario) {
          speakText(data.scenario);
        }
        if (data.message) {
          // Add a small delay before speaking the message
          setTimeout(() => speakText(data.message), 1000);
        }
      }

      // Comment out database operations for now
      /*
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          role: roleId,
          scenario: data.scenario || 'Loading scenario...',
        })
        .select()
        .maybeSingle();

      if (sessionError) throw sessionError;
      if (sessionData) {
        setSessionId(sessionData.id);
        setScenario(data.scenario);
        await supabase
          .from('sessions')
          .update({ scenario: data.scenario })
          .eq('id', sessionData.id);
      }

      setMessages([{ role: 'ai', content: data.message, icon: '🤖' }]);

      if (sessionData) {
        await supabase.from('messages').insert({
          session_id: sessionData.id,
          role: 'ai',
          content: data.message,
        });
      }
      */
    } catch (error) {
      console.error('Error starting session:', error);
      setMessages([{ role: 'ai', content: 'Sorry, there was an error starting the session. Please try again.', icon: '🤖' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !sessionId || isLoading) return;

    const userMessage = inputValue;
    setInputValue('');
    setIsLoading(true);

    const newMessages = [...messages, { role: 'user', content: userMessage, icon: '👤' }];
    setMessages(newMessages);

    try {
      // Comment out database operations for now
      /*
      await supabase.from('messages').insert({
        session_id: sessionId,
        role: 'user',
        content: userMessage,
      });
      */

      const messageCount = messages.filter(m => m.role === 'user').length;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-communication-coach`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: selectedRole,
          userMessage,
          conversationHistory: messages,
          messageCount,
        }),
      });

      const data = await response.json();

      if (data.score) {
        setTotalScore(prev => prev + data.score);
      }

      const aiMessage = {
        role: 'ai',
        content: data.message,
        icon: '🤖',
        feedback: data.feedback,
        correctedResponse: data.correctedResponse
      };

      setMessages(prev => [...prev, aiMessage]);
      setProgress(Math.min(progress + 10, 100));

      // Speak the AI response if voice is enabled (questions are read aloud)
      if (voiceEnabled && data.message) {
        speakText(data.message);
      }

      // Comment out database operations for now
      /*
      await supabase.from('messages').insert({
        session_id: sessionId,
        role: 'ai',
        content: data.message,
        feedback: data.feedback || '',
      });
      */

      if (data.isComplete) {
        const avgScore = Math.round(totalScore / (messageCount + 1));
        // Comment out database operations for now
        /*
        await supabase
          .from('sessions')
          .update({
            completed: true,
            score: avgScore,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
        */

        setShowFeedback(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'ai',
        content: 'Sorry, there was an error processing your message. Please try again.',
        icon: '🤖'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewSession = () => {
    setSelectedRole('');
    setShowChat(false);
    setShowFeedback(false);
    setMessages([]);
    setProgress(0);
    setSessionId(null);
    setScenario('');
    setTotalScore(0);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const fetchDailyProgress = async () => {
      // Mock daily progress for testing
      setDailyProgress(Math.floor(Math.random() * 5)); // Random number between 0-4 for testing

      // Comment out database operations for now
      /*
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from('sessions')
        .select('id')
        .eq('completed', true)
        .gte('created_at', today.toISOString());

      if (data) {
        setDailyProgress(Math.min(data.length, 10));
      }
      */
    };

    fetchDailyProgress();
  }, [showFeedback]);

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-blue-200/20 to-cyan-200/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-indigo-200/20 to-blue-200/20 rounded-full blur-3xl animate-float-delayed"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-r from-cyan-200/20 to-teal-200/20 rounded-full blur-3xl animate-float-slow"></div>
      </div>

      <div className="w-full max-w-6xl bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200 relative">
        <header className="px-8 py-8 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>
          <div className="relative flex items-center gap-6">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-xl animate-pulse">
              🎯
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">AI Communication Coach</h1>
              <p className="text-white/90 text-base font-medium">Master professional communication skills with AI-powered practice</p>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
        </header>

        {!showChat && (
          <div className="p-10 border-b border-slate-100">
            <h2 className="text-2xl font-bold mb-8 text-center text-slate-800 tracking-tight">Choose Your Professional Role</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => handleRoleSelect(role.id)}
                  className={`group px-6 py-4 bg-gradient-to-br ${role.gradient} border-2 border-white/50 rounded-xl ${role.hover} hover:border-white hover:shadow-xl ${role.shadow} transition-all duration-300 transform hover:-translate-y-2 hover:scale-105`}
                >
                  <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">{role.icon}</div>
                  <div className="font-bold text-white drop-shadow-sm">{role.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {showChat && selectedRole && (
          <>
            <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-blue-50 via-cyan-50 to-teal-50">
              <h2 className="text-lg font-semibold mb-4 text-slate-800 flex items-center gap-2">
                <span className="text-2xl animate-pulse">🎭</span>
                Current Scenario
              </h2>
              <p className="text-slate-700 bg-gradient-to-r from-white to-blue-50 p-6 rounded-xl shadow-lg border-l-4 border-blue-400 whitespace-pre-line">
                {scenario || 'Practice your professional communication skills in a realistic workplace scenario.'}
              </p>
            </div>

            <main className="p-6 h-[55vh] overflow-y-auto bg-gradient-to-b from-slate-50 via-blue-50 to-cyan-50 relative">
              <div className="absolute inset-0 opacity-5">
                <div className="absolute top-10 left-10 w-20 h-20 bg-blue-300 rounded-full"></div>
                <div className="absolute top-32 right-16 w-16 h-16 bg-cyan-300 rounded-full"></div>
                <div className="absolute bottom-20 left-1/4 w-12 h-12 bg-teal-300 rounded-full"></div>
                <div className="absolute bottom-32 right-1/3 w-24 h-24 bg-blue-200 rounded-full"></div>
              </div>

              {messages.map((msg, idx) => (
                <div key={idx} className="py-4 px-6 relative">
                  <div className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-10 h-10 rounded-full ${msg.role === 'user' ? 'bg-gradient-to-br from-cyan-400 to-teal-400' : 'bg-gradient-to-br from-blue-400 to-indigo-400'} flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0`}>
                      <span className="text-lg">{msg.icon}</span>
                    </div>
                    <div className="flex-1 max-w-[80%]">
                      <div className={`${msg.role === 'user' ? 'bg-gradient-to-br from-cyan-500 to-teal-500 text-white' : 'bg-white text-slate-800'} rounded-2xl px-5 py-4 shadow-xl border border-slate-100 backdrop-blur-sm`}>
                        <div className="leading-relaxed whitespace-pre-line">{msg.content}</div>
                      </div>
                      {msg.feedback && (
                        <div className="mt-2 ml-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                          💡 {msg.feedback}
                        </div>
                      )}
                      {msg.correctedResponse && msg.correctedResponse !== msg.content && (
                        <div className="mt-2 ml-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                          📝 <strong>Corrected:</strong> {msg.correctedResponse}
                        </div>
                      )}
                      <div className={`text-xs text-slate-500 mt-2 ${msg.role === 'user' ? 'text-right mr-2' : 'ml-2'} opacity-70`}>Just now</div>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="py-4 px-6 relative">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-400 flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0 animate-pulse">
                      <span className="text-lg">🤖</span>
                    </div>
                    <div className="flex-1 max-w-[80%]">
                      <div className="bg-white text-slate-800 rounded-2xl px-5 py-4 shadow-xl border border-slate-100 backdrop-blur-sm">
                        <div className="flex gap-2">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </main>

            {showFeedback && (
              <div className="p-8 border-t bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full mb-4 animate-bounce">
                    <span className="text-3xl">🎉</span>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800">Session Complete!</h2>
                </div>
                <div className="flex items-center justify-center gap-4 mb-6">
                  <div className="text-5xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">{Math.round(totalScore / messages.filter(m => m.role === 'user').length) || 85}</div>
                  <div className="text-lg text-slate-600">/100</div>
                </div>
                <p className="text-slate-700 text-center bg-gradient-to-r from-white to-emerald-50 p-4 rounded-lg shadow-lg">
                  Excellent work! Your communication skills are improving.
                </p>
                <div className="text-center mt-6">
                  <button
                    onClick={handleNewSession}
                    className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white px-8 py-3 rounded-xl font-semibold hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 hover:scale-105"
                  >
                    Start New Session
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="px-8 py-6 border-t bg-gradient-to-r from-blue-50 via-cyan-50 to-teal-50">
              <div className="flex gap-3 mb-4">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your response here..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`px-4 py-3 rounded-xl shadow-lg transition-all duration-300 font-semibold transform hover:-translate-y-1 hover:scale-105 relative overflow-hidden group ${
                    isRecording
                      ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600 hover:shadow-xl animate-pulse'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 hover:shadow-xl'
                  }`}
                  disabled={isLoading}
                  title={isRecording ? 'Stop recording and transcribe speech' : 'Start voice recording'}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {isRecording ? (
                      <>
                        <span className="animate-pulse">⏹️</span>
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <span>🎤</span>
                        Voice Input
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-xl shadow-lg hover:from-blue-600 hover:to-cyan-600 hover:shadow-xl transition-all duration-300 font-semibold transform hover:-translate-y-1 hover:scale-105 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <span className="relative z-10">{isLoading ? 'Processing...' : 'Send Response'}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
                <button
                  type="button"
                  onClick={handleNewSession}
                  className="bg-gradient-to-r from-red-400 to-rose-400 text-white px-6 py-3 rounded-xl shadow-lg hover:from-red-500 hover:to-rose-500 hover:shadow-xl transition-all duration-300 font-semibold transform hover:-translate-y-1"
                >
                  Stop Session
                </button>
              </div>

              {/* Voice Assistant Controls */}
              <div className="flex items-center gap-4 p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-slate-200 shadow-lg">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVoiceEnabled(!voiceEnabled)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
                      voiceEnabled
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                    title={voiceEnabled ? 'Disable voice responses' : 'Enable voice responses'}
                  >
                    {voiceEnabled ? '🔊 Voice On' : '🔇 Voice Off'}
                  </button>
                </div>

                {voiceEnabled && (
                  <>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-700">Volume:</label>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.1"
                        value={voiceVolume}
                        onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                        className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        title={`Voice volume: ${Math.round(voiceVolume * 100)}%`}
                      />
                      <span className="text-sm text-slate-600 w-8">{Math.round(voiceVolume * 100)}%</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-700">Speed:</label>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={voiceSpeed}
                        onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                        className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        title={`Voice speed: ${voiceSpeed}x`}
                      />
                      <span className="text-sm text-slate-600 w-8">{voiceSpeed}x</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-700">Voice:</label>
                      <select
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {availableVoices.map((voice) => (
                          <option key={voice.name} value={voice.name}>
                            {voice.name} ({voice.lang})
                          </option>
                        ))}
                      </select>
                    </div>

                    {isSpeaking && (
                      <div className="flex items-center gap-2 text-orange-600 animate-pulse">
                        <span className="text-lg">🔊</span>
                        <span className="text-sm font-medium">Speaking...</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={stopSpeaking}
                      className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                      title="Stop speaking"
                    >
                      Stop
                    </button>
                  </>
                )}
              </div>
            </form>

            <div className="px-8 py-4 bg-gradient-to-r from-blue-100 via-cyan-100 to-teal-100 border-t border-blue-200 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
              <div className="relative flex items-center justify-between text-sm font-medium text-slate-700 mb-3">
                <span className="flex items-center gap-2">
                  <span className="text-lg animate-pulse">📈</span>
                  Progress: {progress /
                   10}/10 questions
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-lg animate-pulse">🎯</span>
                  Daily: {dailyProgress}/10 completed
                </span>
              </div>
              <div className="relative w-full bg-gradient-to-r from-blue-200 to-cyan-200 rounded-full h-4 shadow-inner overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 h-4 rounded-full transition-all duration-500 shadow-lg"
                  style={{ width: `${progress}%` }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
