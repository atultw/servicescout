"use client";

import { Session, Business } from "../lib/types";
import { BotIcon, UserIcon } from "./Icons";
import { Mic, MicOff, Send, Sparkles, MessageCircle } from "lucide-react";
import SuggestedBusinesses from "./SuggestedBusinesses";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRef, useEffect } from "react";

interface ChatAreaProps {
    activeSession: Session | undefined;
    candidates: Business[];
    message: string;
    setMessage: (value: string) => void;
    handleSendMessage: () => void;
    isVoiceConnected: boolean;
    isVoiceStreaming: boolean;
    voiceStatus: string;
    liveMessage: {text: string, role: 'user' | 'agent'} | null;
    connectVoiceChat: () => void;
    disconnectVoiceChat: () => void;
    toggleVoiceStreaming: () => void;
}

export default function ChatArea({ 
    activeSession, 
    candidates, 
    message,
    setMessage,
    handleSendMessage,
    isVoiceConnected,
    isVoiceStreaming,
    voiceStatus,
    liveMessage,
    connectVoiceChat,
    disconnectVoiceChat,
    toggleVoiceStreaming
}: ChatAreaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [message]);

    useEffect(() => {
        // Auto-scroll to bottom when new messages arrive
        const scrollToBottom = () => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'end',
                    inline: 'nearest' 
                });
            }
        };

        // Small delay to ensure DOM has updated
        const timeoutId = setTimeout(scrollToBottom, 100);
        return () => clearTimeout(timeoutId);
    }, [activeSession?.history, liveMessage]);
    
    if (!activeSession) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center h-full px-4 py-12 text-center">
                <div className="max-w-lg">
                    <h2 className="text-3xl font-bold mb-4 text-gray-500">
                        Welcome to ServiceScout
                    </h2>
                    <p className="text-lg text-gray-400 leading-relaxed">
                        Select a scout from the sidebar or create a new one to start chatting.
                    </p>
                </div>
            </div>
        )
    }

    // Determine what content to show in the conversation area
    const hasConversation = activeSession.history.length > 0;
    const showEmptyState = !hasConversation;

    return (
        <div className="flex-1 flex flex-col bg-bg-primary overflow-hidden min-h-0">
            {/* Modern Header */}
            <header className="py-4 px-4 bg-bg-secondary border-b border-border shadow-sm flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-400 p-2 rounded-lg">
                            <BotIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-text-light">
                                {activeSession.name}
                            </h2>
                            {activeSession.description && (
                                <p className="text-sm text-text-muted mt-1">{activeSession.description}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                            isVoiceConnected 
                                ? (isVoiceStreaming ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-accent-blue-lighter text-accent-blue-dark border border-accent-blue-light')
                                : 'bg-gray-50 text-gray-600 border border-gray-200'
                        }`}>
                            <div className={`w-2 h-2 rounded-full ${
                                isVoiceConnected 
                                    ? (isVoiceStreaming ? 'bg-green-500 animate-pulse' : 'bg-accent-blue')
                                    : 'bg-gray-400'
                            }`}></div>
                            {voiceStatus}
                        </div>
                    </div>
                </div>
            </header>
            
            {/* Suggested Businesses */}
            {candidates && candidates.length > 0 && (
                <SuggestedBusinesses candidates={candidates} />
            )}
            
            {/* Messages Area - Scrollable Container */}
            <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto bg-bg-primary scroll-smooth chat-scroll overflow-x-hidden" 
                style={{ 
                    minHeight: 0
                }}
            >
                <div className="h-full flex flex-col">
                    <div className="w-full px-4 py-3 space-y-4 flex-1 flex flex-col">
                        {showEmptyState ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center">
                                <div className="max-w-xl">
                                    <h2 className="text-2xl font-medium mb-4 text-gray-500">How can I help today?</h2>
                                    <p className="text-lg text-gray-400 mb-4 leading-relaxed">
                                        I can place phone calls to any business, from restaurants to contractors, to find you the best offerings and prices.
                                    </p>
                                    <p className="text-sm text-gray-400">
                                        💬 Type your message below or 🎤 use voice chat to speak naturally!
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 pb-4 flex-1">
                                {/* Conversation History */}
                                {activeSession.history.map((chat, index) => (
                                    <div key={`conversation-${index}`} className="space-y-3">
                                        {chat.user && chat.user.trim() !== "" && (
                                            <div className="flex items-start gap-4 justify-end">
                                                <div className="bg-blue-400 text-white p-4 rounded-2xl max-w-lg shadow-lg break-words word-wrap">
                                                    <p className="leading-relaxed whitespace-pre-wrap">{chat.user}</p>
                                                </div>
                                                <div className="bg-accent-blue-lighter p-3 rounded-full border border-accent-blue-light shadow-sm flex-shrink-0">
                                                    <UserIcon className="h-6 w-6 text-accent-blue-dark" />
                                                </div>
                                            </div>
                                        )}
                                        {chat.agent && chat.agent.trim() !== "" && chat.agent !== "..." && (
                                            <div className="flex items-start gap-4 justify-start">
                                                <div className="bg-blue-500 p-3 rounded-full shadow-sm flex-shrink-0">
                                                    <BotIcon className="h-6 w-6 text-white" />
                                                </div>
                                                <div className="bg-bg-secondary border border-border text-text-light p-4 rounded-2xl max-w-lg shadow-lg prose prose-gray prose-sm break-words word-wrap">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{chat.agent}</ReactMarkdown>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                
                                {/* Live Message */}
                                {liveMessage && liveMessage.text.trim() && (
                                    <div className={`flex items-start gap-4 ${liveMessage.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        {liveMessage.role === 'agent' && (
                                            <div className="bg-blue-500 p-3 rounded-full shadow-sm flex-shrink-0">
                                                <BotIcon className="h-6 w-6 text-white" />
                                            </div>
                                        )}
                                        <div className={`p-4 rounded-2xl max-w-lg shadow-lg border-2 border-dashed break-words word-wrap ${
                                            liveMessage.role === 'user' 
                                                ? 'bg-accent-blue-lighter text-accent-blue-dark border-accent-blue-light' 
                                                : 'bg-gray-50 text-gray-700 border-gray-300'
                                        }`}>
                                            <p className="italic leading-relaxed whitespace-pre-wrap">{liveMessage.text}...</p>
                                        </div>
                                        {liveMessage.role === 'user' && (
                                            <div className="bg-accent-blue-lighter p-3 rounded-full border border-accent-blue-light shadow-sm flex-shrink-0">
                                                <UserIcon className="h-6 w-6 text-accent-blue-dark" />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Scroll anchor */}
                        <div ref={messagesEndRef} className="h-1 flex-shrink-0" />
                    </div>
                </div>
            </div>
            
            {/* Modern Input Area */}
            <div className="bg-bg-secondary border-t border-border flex-shrink-0 px-4 py-3">
                <div className="w-full">
                    {/* Text Input with Voice Controls */}
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <textarea
                                ref={textareaRef}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        if (message.trim()) {
                                            handleSendMessage();
                                        }
                                    }
                                }}
                                placeholder="Ask me anything about services you need..."
                                className="w-full pl-6 pr-16 py-3 bg-bg-primary border-2 border-border rounded-2xl focus:outline-none focus:border-accent-blue focus:ring-4 focus:ring-accent-blue/10 text-text-light transition-all resize-none shadow-lg"
                                rows={1}
                                style={{ lineHeight: '1.5rem', minHeight: '3rem', maxHeight: '200px' }}
                            />
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!message.trim()}
                                    className="p-2 bg-blue-400 hover:bg-blue-500 rounded-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                                >
                                    <Send className="h-5 w-5 text-white" />
                                </button>
                            </div>
                        </div>

                        {/* Voice Controls */}
                        <div className="flex-shrink-0">
                            <button
                                onClick={!isVoiceConnected ? connectVoiceChat : disconnectVoiceChat}
                                className={`group relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                                    isVoiceConnected && isVoiceStreaming
                                        ? 'bg-red-500 hover:bg-red-600 hover:scale-110 animate-pulse'
                                        : isVoiceConnected
                                            ? 'bg-green-500 hover:bg-green-600 hover:scale-110'
                                            : 'bg-blue-400 hover:bg-blue-500 hover:scale-110'
                                }`}
                            >
                                {isVoiceConnected ? (
                                    isVoiceStreaming ? <MicOff size={20} className="text-white" /> : <Mic size={20} className="text-white" />
                                ) : (
                                    <Mic size={20} className="text-white" />
                                )}
                                
                                {/* Ripple effect for active recording */}
                                {isVoiceConnected && isVoiceStreaming && (
                                    <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30"></div>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
