"use client";

import { useState, useEffect, useRef, useCallback } from "react";
// Use environment variable for backend URL
const backendUrl = "https://nlpconnector.web.app";
import { auth } from "./firebase";
import { RecaptchaVerifier, User } from "firebase/auth";
import Sidebar from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import CallsPanel from "@/components/CallsPanel";
import CallDetailsPanel from "@/components/CallDetails";
import { Session, Call, CallDetails as CallDetailsType, Business } from "@/lib/types";
import Login from "../components/Login";

// Extend the window interface to include the reCAPTCHA verifier and SpeechRecognition
declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface TranscriptionMessage {
  type: 'transcription';
  role: 'user' | 'agent';
  text: string;
}

interface AudioMessage {
  type: 'audio';
  data: string;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

interface CandidatesMessage {
  type: 'candidates';
  candidates: any;
}

interface StatusMessage {
  type: 'turn_complete' | 'interrupted' | 'conversation_ended' | 'stop_audio' | 'auth_success';
}

type WebSocketMessage = TranscriptionMessage | AudioMessage | StatusMessage | CandidatesMessage;

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallDetailsType | null>(null);
  const [candidates, setCandidates] = useState<Business[]>([]);

  // Text input state
  const [message, setMessage] = useState("");

  // Voice chat states
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isVoiceStreaming, setIsVoiceStreaming] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>('Disconnected');

  // Live chat bubble state
  const [liveMessage, setLiveMessage] = useState<{ role: 'user' | 'agent', text: string } | null>(null);

  // Voice chat refs
  const wsRef = useRef<WebSocket | null>(null);

  // Function to finalize the live message into conversation history
  const finalizeLiveMessage = useCallback(() => {
    fetchCalls();
    console.log('finalizeLiveMessage called');
    setLiveMessage(prevLiveMessage => {
      console.log('finalizeLiveMessage - prevLiveMessage:', prevLiveMessage);
      let didFinalize = false;
      if (prevLiveMessage && prevLiveMessage.text.trim() && activeSessionId) {
        console.log('finalizeLiveMessage - Processing message:', prevLiveMessage);
        // Update sessions state using the current state
        setSessions(currentSessions => {
          const activeSession = currentSessions.find(s => s.id === activeSessionId);
          console.log('finalizeLiveMessage - activeSession:', activeSession);
          if (!activeSession) return currentSessions;

          const lastEntry = activeSession.history[activeSession.history.length - 1];
          console.log('finalizeLiveMessage - lastEntry:', lastEntry);
          let newHistory = [...activeSession.history];

          if (prevLiveMessage.role === 'user') {
            // Check if this user message is already in history to avoid duplicates
            const alreadyExists = activeSession.history.some(entry =>
              entry.user === prevLiveMessage.text
            );
            if (!alreadyExists) {
              console.log('finalizeLiveMessage - adding user message:', prevLiveMessage.text);
              newHistory = [...activeSession.history, { user: prevLiveMessage.text, agent: "..." }];
              didFinalize = true;
            } else {
              console.log('finalizeLiveMessage - user message already exists, skipping');
            }
          } else if (prevLiveMessage.role === 'agent') {
            if (lastEntry && lastEntry.agent === "...") {
              console.log('finalizeLiveMessage - replacing agent placeholder:', prevLiveMessage.text);
              newHistory = [...activeSession.history.slice(0, -1), { user: lastEntry.user, agent: prevLiveMessage.text }];
              didFinalize = true;
            } else {
              // Check if this agent message is already in history to avoid duplicates
              const alreadyExists = activeSession.history.some(entry =>
                entry.agent === prevLiveMessage.text
              );
              if (!alreadyExists) {
                console.log('finalizeLiveMessage - adding standalone agent message:', prevLiveMessage.text);
                newHistory = [...activeSession.history, { user: "", agent: prevLiveMessage.text }];
                didFinalize = true;
              } else {
                console.log('finalizeLiveMessage - agent message already exists, skipping');
              }
            }
          }

          console.log('finalizeLiveMessage - final newHistory:', newHistory);
          return currentSessions.map(s =>
            s.id === activeSessionId ? { ...s, history: newHistory } : s
          );
        });
      } else {
        console.log('finalizeLiveMessage - No message to finalize or empty message');
      }
      // Clear the live message
      console.log('finalizeLiveMessage - clearing live message');
      return null;
    });
  }, [activeSessionId]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioQueueRef = useRef<AudioMessage[]>([]);
  const isPlayingRef = useRef<boolean>(false);


  const fetchCalls = useCallback(async () => {
    if (!activeSessionId || !user) {
      console.log("fetchCalls early return", { activeSessionId, user });
      setCalls([]);
      return;
    }
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${backendUrl}/api/sessions/${activeSessionId}/calls`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch calls.');
      }
      const data = await response.json();
      setCalls(data.calls);
    } catch (error: any) {
      setError(error.message);
    }
  }, [activeSessionId, user]);

  const fetchSessionConversation = useCallback(async (sessionId: string) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${backendUrl}/api/sessions/${sessionId}/conversation`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });
      if (!response.ok) {
        if (response.status === 404) {
          // No conversation found, that's okay for new sessions
          return;
        }
        throw new Error('Failed to fetch session conversation.');
      }
      const data = await response.json();

      // Convert conversation to history format for display
      const history: { user: string; agent: string }[] = [];
      let currentEntry: { user: string; agent: string } = { user: "", agent: "" };

      data.conversation.forEach((entry: any) => {
        if (entry.role === "user") {
          if (currentEntry.user || currentEntry.agent) {
            // Save previous entry if it has content
            history.push({ ...currentEntry });
            currentEntry = { user: "", agent: "" };
          }
          currentEntry.user = entry.text;
        } else if (entry.role === "agent" || entry.role === "model") {
          currentEntry.agent = entry.text;
        }
      });

      // Add the last entry if it has content
      if (currentEntry.user || currentEntry.agent) {
        history.push(currentEntry);
      }

      // Update the session with the loaded conversation history
      setSessions(currentSessions =>
        currentSessions.map(s =>
          s.id === sessionId
            ? { ...s, history: history }
            : s
        )
      );

    } catch (error: any) {
      console.error('Error fetching session conversation:', error);
      // Don't set error state for conversation loading failures as they're not critical
    }
  }, [user]);

  // Voice chat functions
  const clearAudioQueue = () => {
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop();
      } catch (e) {
        // Audio source may already be stopped
      }
      currentAudioSourceRef.current = null;
    }
  };

  const queueAudio = (message: AudioMessage) => {
    audioQueueRef.current.push(message);
    if (!isPlayingRef.current) {
      playNextAudio();
    }
  };

  const playNextAudio = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const message = audioQueueRef.current.shift()!;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const binaryString = atob(message.data);
      const arrayBuffer = new ArrayBuffer(binaryString.length);
      const uint8View = new Uint8Array(arrayBuffer);

      for (let i = 0; i < binaryString.length; i++) {
        uint8View[i] = binaryString.charCodeAt(i);
      }

      const sampleCount = arrayBuffer.byteLength / 2;

      const audioBuffer = audioContext.createBuffer(
        message.channels,
        sampleCount,
        message.sampleRate
      );

      const channelData = audioBuffer.getChannelData(0);
      const dataView = new DataView(arrayBuffer);

      for (let i = 0; i < sampleCount; i++) {
        const sample = dataView.getInt16(i * 2, true);
        channelData[i] = sample / 32768.0;
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      currentAudioSourceRef.current = source;

      source.onended = () => {
        if (currentAudioSourceRef.current === source) {
          currentAudioSourceRef.current = null;
        }
        setTimeout(() => playNextAudio(), 0);
      };

      source.start();

    } catch (error) {
      console.error('Error playing audio:', error);
      setTimeout(() => playNextAudio(), 0);
    }
  };

  const connectChat = async () => {
    if (!activeSessionId || !user) {
      setError("Please select a session first.");
      return;
    }

    try {
      const token = await user.getIdToken();
      const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
      const wsHost = "backend-581277715925.us-central1.run.app";
      const ws = new WebSocket(`${wsProtocol}://${wsHost}/api/ws/${activeSessionId}`);

      ws.onopen = () => {
        console.log('WebSocket connected');
        // Send authentication
        ws.send(JSON.stringify({
          type: 'auth',
          token: token
        }));
      };

      ws.onmessage = async (event) => {
        const message: WebSocketMessage = JSON.parse(event.data);

        if (message.type === 'auth_success') {
          setIsVoiceConnected(true);
          setVoiceStatus('Ready');
          wsRef.current = ws;
          // Send start message and automatically begin voice streaming
          ws.send(JSON.stringify({ type: 'start' }));
          // Auto-start voice streaming
          setTimeout(() => startVoiceStreaming(), 100);
        } else if (message.type === 'transcription') {
          // Handle transcription messages - only update live message for real-time display
          // Vertex AI sessions automatically handle conversation persistence

          setLiveMessage(prevLiveMessage => {
            if (prevLiveMessage && prevLiveMessage.role === message.role) {
              // Same speaker - append text
              return {
                role: message.role,
                text: prevLiveMessage.text + ' ' + message.text
              };
            } else {
              // Different speaker - need to finalize previous message first
              if (prevLiveMessage) {
                // Finalize the previous message immediately
                setSessions(currentSessions => {
                  const activeSession = currentSessions.find(s => s.id === activeSessionId);
                  if (!activeSession) return currentSessions;

                  const lastEntry = activeSession.history[activeSession.history.length - 1];
                  let newHistory = [...activeSession.history];

                  if (prevLiveMessage.role === 'user') {
                    // Check if this user message is already in history to avoid duplicates
                    const alreadyExists = activeSession.history.some(entry =>
                      entry.user === prevLiveMessage.text
                    );
                    if (!alreadyExists) {
                      newHistory = [...activeSession.history, { user: prevLiveMessage.text, agent: "..." }];
                    }
                  } else if (prevLiveMessage.role === 'agent') {
                    if (lastEntry && lastEntry.agent === "...") {
                      newHistory = [...activeSession.history.slice(0, -1), { user: lastEntry.user, agent: prevLiveMessage.text }];
                    } else {
                      // Check if this agent message is already in history to avoid duplicates
                      const alreadyExists = activeSession.history.some(entry =>
                        entry.agent === prevLiveMessage.text
                      );
                      if (!alreadyExists) {
                        newHistory = [...activeSession.history, { user: "", agent: prevLiveMessage.text }];
                      }
                    }
                  }

                  return currentSessions.map(s =>
                    s.id === activeSessionId ? { ...s, history: newHistory } : s
                  );
                });
              }

              // Return new live message
              return {
                role: message.role,
                text: message.text
              };
            }
          });
        } else if (message.type === 'audio') {
          queueAudio(message);
        } else if (message.type === 'candidates') {
          console.log('Received candidates message:', message);
          console.log('message.candidates:', message.candidates);
          console.log('message.candidates type:', typeof message.candidates);

          if (message.candidates) {
            // Handle both possible structures
            let businesses = null;

            if (message.candidates.businesses && Array.isArray(message.candidates.businesses)) {
              businesses = message.candidates.businesses;
              console.log('Using message.candidates.businesses:', businesses);
            } else if (Array.isArray(message.candidates)) {
              businesses = message.candidates;
              console.log('Using message.candidates directly:', businesses);
            } else {
              console.log('Unable to find businesses array in candidates message');
              console.log('Full structure:', JSON.stringify(message.candidates, null, 2));
            }

            if (businesses && businesses.length > 0) {
              console.log('Setting candidates state:', businesses);
              setCandidates(businesses);
              console.log('Candidates state should now be:', businesses);
            } else {
              console.log('No valid businesses found to set');
              setCandidates([]); // Clear previous candidates
            }
          } else {
            console.log('No candidates in message');
            setCandidates([]);
          }
        } else if (message.type === 'turn_complete') {
          console.log('Turn complete - finalizing any remaining live message');

          // Only finalize if there's actually a live message remaining
          finalizeLiveMessage();
          setVoiceStatus('Turn complete');

        } else if (message.type === 'interrupted') {
          finalizeLiveMessage();
          setVoiceStatus('Interrupted');
          clearAudioQueue();
        } else if (message.type === 'stop_audio') {
          clearAudioQueue();
        } else if (message.type === 'conversation_ended') {
          finalizeLiveMessage();
          setVoiceStatus('Conversation ended');
          disconnectChat();
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsVoiceConnected(false);
        setVoiceStatus('Disconnected');
        wsRef.current = null;
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setVoiceStatus('Connection error');
      };

    } catch (error) {
      console.error('Failed to connect chat:', error);
      setVoiceStatus('Connection failed');
    }
  };

  // Alias for backward compatibility
  const connectVoiceChat = connectChat;

  const disconnectChat = () => {
    // Finalize any pending live message before disconnecting
    finalizeLiveMessage();

    if (wsRef.current) {
      if (isVoiceStreaming) {
        stopVoiceStreaming();
      }
      wsRef.current.send(JSON.stringify({ type: 'end' }));
      wsRef.current.close();
      wsRef.current = null;
    }
    clearAudioQueue();
    setIsVoiceConnected(false);
    setIsVoiceStreaming(false);
    setVoiceStatus('Disconnected');

    // Reset live message
    setLiveMessage(null);
  };

  // Alias for backward compatibility
  const disconnectVoiceChat = disconnectChat;

  const startVoiceStreaming = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          return;
        }

        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);

        const inputSampleRate = audioContext.sampleRate;
        const targetSampleRate = 16000;

        let processedData = inputData;

        if (inputSampleRate !== targetSampleRate) {
          const resampleRatio = inputSampleRate / targetSampleRate;
          const targetLength = Math.floor(inputData.length / resampleRatio);
          const resampledData = new Float32Array(targetLength);

          for (let i = 0; i < targetLength; i++) {
            const sourceIndex = Math.floor(i * resampleRatio);
            resampledData[i] = inputData[sourceIndex];
          }
          processedData = resampledData;
        }

        const pcmData = new Int16Array(processedData.length);
        for (let i = 0; i < processedData.length; i++) {
          let sample = processedData[i];
          sample = Math.max(-1, Math.min(1, sample));
          pcmData[i] = Math.round(sample * 32767);
        }

        const uint8Array = new Uint8Array(pcmData.buffer);
        const base64Audio = btoa(String.fromCharCode(...uint8Array));

        wsRef.current.send(JSON.stringify({
          type: 'audio',
          data: base64Audio
        }));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsVoiceStreaming(true);
      setVoiceStatus('Listening...');

    } catch (error) {
      console.error('Failed to start voice streaming:', error);
      setVoiceStatus('Microphone access denied');
    }
  };

  const stopVoiceStreaming = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      streamRef.current = null;
    }

    setIsVoiceStreaming(false);
    setVoiceStatus('Ready');
  };

  const toggleVoiceStreaming = () => {
    if (isVoiceStreaming) {
      stopVoiceStreaming();
    } else {
      startVoiceStreaming();
    }
  };

  const handleSendMessage = async () => {
    console.log("handleSendMessage")
    if (!message.trim() || !user || !activeSessionId) return;

    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession) return;

    // If not connected to WebSocket, connect first
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      await connectChat();
      // Wait a moment for connection to establish
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Send text message through WebSocket
      wsRef.current.send(JSON.stringify({
        type: 'text',
        text: message
      }));

      // Update local UI immediately
      const newHistory = [...activeSession.history, { user: message, agent: "..." }];
      const updatedSessions = sessions.map(s =>
        s.id === activeSessionId ? { ...s, history: newHistory } : s
      );
      setSessions(updatedSessions);

      setMessage(""); // Clear message from input
      console.log('Message sent, fetching calls to refresh');
      fetchCalls(); // Refresh calls
    } else {
      setError("Unable to connect to chat. Please try again.");
    }
  };

  useEffect(() => {
    const fetchSessions = async (user: User) => {
      try {
        const token = await user.getIdToken();
        const response = await fetch(`${backendUrl}/api/sessions`, {
          headers: {
            'Authorization': `Bearer ${token}`
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch sessions.');
        }
        const data = await response.json();
        const fetchedSessions: Session[] = data.sessions.map((s: any) => ({
          id: s.session_id,
          name: s.title,
          description: s.description,
          history: [] // History will be loaded on-demand
        }));
        setSessions(fetchedSessions);
      } catch (error: any) {
        setError(error.message);
      }
    };

    // This effect runs once to set up the reCAPTCHA verifier
    window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      'size': 'invisible',
      'callback': (response: any) => {
        // reCAPTCHA solved, allow signInWithPhoneNumber.
      }
    });

    // This listener checks for the current auth state
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUser(user);
        fetchSessions(user);
      } else {
        setUser(null);
        setSessions([]);
        setActiveSessionId(null);
      }
    });

    return () => {
      unsubscribe(); // Cleanup subscription on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      clearAudioQueue();
    }
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      fetchCalls(); // Initial fetch only, no recurring polling
    }
  }, [activeSessionId, fetchCalls]);

  useEffect(() => {
    // When session changes, clear candidates and selected call from the previous session
    setCandidates([]);
    setSelectedCall(null);
    setLiveMessage(null);
    setMessage("");
    // Disconnect chat if connected to a different session
    if (isVoiceConnected) {
      disconnectChat();
    }
    // Load conversation history for the new session
    if (activeSessionId) {
      // fetchSessionConversation(activeSessionId);
    }
  }, [activeSessionId, fetchSessionConversation]);

  const handleSelectCall = async (call: Call) => {
    if (selectedCall && selectedCall.call_id === call.call_id) {
      setSelectedCall(null);
      return;
    }

    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${backendUrl}/api/calls/${call.call_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch call details.');
      }
      const data = await response.json();
      setSelectedCall(data);
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleNewRequest = async () => {
    if (!user) {
      setError("You must be logged in to create a new request.");
      return;
    }
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${backendUrl}/api/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create session on the server.');
      }

      const data = await response.json();
      const newSessionId = data.session_id;
      const sessionName = data.title || "New Voice Request";

      const newSession: Session = {
        id: newSessionId,
        name: sessionName,
        description: '',
        history: [],
      };
      setSessions([...sessions, newSession]);
      setActiveSessionId(newSessionId);

    } catch (error: any) {
      console.error("Failed to create new session:", error);
      setError(`Failed to create new session: ${error.message}`);
    }
  };

  if (!user) {
    return <Login />;
  }

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const selectedCallObject = calls.find(c => c.call_id === selectedCall?.call_id) || null;

  return (
    <div className="flex h-screen bg-bg-primary text-text-light">
      {/* Compact Sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-border bg-bg-secondary shadow-lg">
        <Sidebar
          user={user}
          sessions={sessions}
          activeSessionId={activeSessionId}
          handleNewRequest={handleNewRequest}
          setActiveSessionId={setActiveSessionId}
        />
      </div>

      {/* Main Content - Chat Centered */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex-1 w-full flex flex-col min-h-0">
          <ChatArea
            activeSession={activeSession}
            candidates={candidates}
            message={message}
            setMessage={setMessage}
            handleSendMessage={handleSendMessage}
            isVoiceConnected={isVoiceConnected}
            isVoiceStreaming={isVoiceStreaming}
            voiceStatus={voiceStatus}
            liveMessage={liveMessage}
            connectVoiceChat={connectChat}
            disconnectVoiceChat={disconnectChat}
            toggleVoiceStreaming={toggleVoiceStreaming}
          />
        </div>
      </main>

      {/* Right Panel - Calls & Details */}
      <div className="w-96 flex-shrink-0 border-l border-border bg-bg-secondary shadow-lg">
        <div className="h-full flex flex-col">
          <CallsPanel calls={calls} handleSelectCall={handleSelectCall} selectedCall={selectedCallObject} />
          {selectedCall && (
            <div className="border-t border-border">
              <CallDetailsPanel selectedCall={selectedCall} setSelectedCall={setSelectedCall} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
