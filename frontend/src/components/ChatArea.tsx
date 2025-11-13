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
    onlyDbResults: boolean;
    handleToggleOnlyDbResults: (checked: boolean) => void;
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
    toggleVoiceStreaming,
    onlyDbResults,
    handleToggleOnlyDbResults
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

    // Example static message for user
    const exampleMessage = "Try: 'Can you get me quotes for hardwood installation?'";

    return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden min-h-0 rounded-2xl shadow-xl px-4 py-4">
            {/* Modern Header */}
            <header className="py-2 px-0 border-b border-gray-200 flex-shrink-0 mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-500 p-3 rounded-lg">
                            <BotIcon className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">
                                {activeSession.name}
                            </h2>
                            {activeSession.description && (
                                <p className="text-base text-gray-500 mt-1">{activeSession.description}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                            isVoiceConnected 
                                ? (isVoiceStreaming ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-blue-100 text-blue-700 border border-blue-200')
                                : 'bg-gray-50 text-gray-600 border border-gray-200'
                        }`}>
                            <div className={`w-2 h-2 rounded-full ${
                                isVoiceConnected 
                                    ? (isVoiceStreaming ? 'bg-green-500 animate-pulse' : 'bg-blue-500')
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
                className="flex-1 overflow-y-auto scroll-smooth chat-scroll overflow-x-hidden" 
                style={{ minHeight: 0 }}
            >
                <div className="h-full flex flex-col">
                    <div className="w-full px-0 py-0 space-y-4 flex-1 flex flex-col">
                        {/* Static example message above bubbles */}
                        <div className="w-full flex items-center justify-center mb-2">
                            <span className="text-gray-400 text-base font-medium text-center">{exampleMessage}</span>
                        </div>
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
                                                <div className="bg-blue-100 p-3 rounded-full border border-blue-200 shadow-sm flex-shrink-0">
                                                    <UserIcon className="h-6 w-6 text-blue-700" />
                                                </div>
                                            </div>
                                        )}
                                        {chat.agent && chat.agent.trim() !== "" && chat.agent !== "..." && (
                                            <div className="flex items-start gap-4 justify-start">
                                                <div className="bg-blue-500 p-3 rounded-full shadow-sm flex-shrink-0">
                                                    <BotIcon className="h-6 w-6 text-white" />
                                                </div>
                                                <div className="bg-blue-50 border border-blue-200 text-gray-700 p-4 rounded-2xl max-w-lg shadow-lg prose prose-gray prose-sm break-words word-wrap">
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
                                                ? 'bg-blue-100 text-blue-700 border-blue-200' 
                                                : 'bg-gray-50 text-gray-700 border-gray-300'
                                        }`}>
                                            <p className="italic leading-relaxed whitespace-pre-wrap">{liveMessage.text}...</p>
                                        </div>
                                        {liveMessage.role === 'user' && (
                                            <div className="bg-blue-100 p-3 rounded-full border border-blue-200 shadow-sm flex-shrink-0">
                                                <UserIcon className="h-6 w-6 text-blue-700" />
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
            <div className="border-t border-gray-200 flex-shrink-0 px-0 pt-4 mt-4">
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
                                className="w-full pl-6 pr-16 py-4 bg-blue-50 border-2 border-blue-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200/10 text-gray-800 transition-all resize-none shadow-lg scrollbar-hide"
                                rows={1}
                                style={{ lineHeight: '1.5rem', minHeight: '3rem', height: '3.5rem', maxHeight: '3.5rem', overflow: 'hidden' }}
                            />
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!message.trim()}
                                    className="p-3 bg-blue-500 hover:bg-blue-600 rounded-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
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
                                            : 'bg-blue-500 hover:bg-blue-600 hover:scale-110'
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
                    {/* Only DB Results Checkbox */}
                    <div className="flex items-center mt-4">
                        <input
                            type="checkbox"
                            id="only-db-results"
                            checked={onlyDbResults}
                            onChange={e => handleToggleOnlyDbResults(e.target.checked)}
                            className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="only-db-results" className="text-sm text-gray-700 select-none cursor-pointer">
                            Only show results from database
                        </label>
                    </div>
                </div>
            </div>
        </div>
    )
}
