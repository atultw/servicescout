"use client";

import { Session } from "../lib/types";
import { BotIcon } from "./Icons";
import { auth } from "../app/firebase";
import { LogOut, Plus, MessageSquare } from "lucide-react";
import { User } from "firebase/auth";

interface SidebarProps {
    user: User | null;
    sessions: Session[];
    activeSessionId: string | null;
    handleNewRequest: () => void;
    setActiveSessionId: (id: string) => void;
}

export default function Sidebar({ user, sessions, activeSessionId, handleNewRequest, setActiveSessionId }: SidebarProps) {
    const handleSignOut = () => {
        auth.signOut();
    };

    const lastFourDigits = user?.phoneNumber ? `...${user.phoneNumber.slice(-4)}` : '';

    return (
        <div className="h-full bg-bg-secondary border-r border-border flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-border">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-400 p-2 rounded-lg">
                        <BotIcon className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-blue-500">
                        ServiceScout
                    </h2>
                </div>
                <button
                    onClick={handleNewRequest}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 font-semibold text-white bg-blue-400 hover:bg-blue-500 rounded-xl shadow-lg hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all"
                >
                    <Plus size={18} className="text-white" />
                    New Scout
                </button>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
                <div className="space-y-2">
                    {sessions.length > 0 ? (
                        sessions.map(session => (
                            <div
                                key={session.id}
                                onClick={() => setActiveSessionId(session.id)}
                                className={`group p-3 rounded-xl cursor-pointer transition-all hover:shadow-md ${
                                    activeSessionId === session.id 
                                        ? 'bg-blue-50 border-2 border-blue-300 shadow-md' 
                                        : 'hover:bg-gray-100 border-2 border-transparent'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg transition-colors ${
                                        activeSessionId === session.id 
                                            ? 'bg-blue-400 text-white' 
                                            : 'bg-gray-200 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-500'
                                    }`}>
                                        <MessageSquare size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-medium truncate ${
                                            activeSessionId === session.id ? 'text-blue-500' : 'text-gray-900'
                                        }`}>
                                            {session.name}
                                        </p>
                                        {session.description && (
                                            <p className="text-xs text-text-muted truncate mt-1">
                                                {session.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8">
                            <div className="bg-bg-tertiary p-4 rounded-xl inline-flex items-center justify-center mb-3">
                                <MessageSquare className="h-8 w-8 text-text-muted" />
                            </div>
                            <p className="text-text-muted text-sm">No conversations yet</p>
                            <p className="text-text-muted text-xs mt-1">Start a new one above!</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border">
                <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-between px-4 py-3 text-text-light bg-bg-tertiary rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 focus:outline-none focus:ring-4 focus:ring-red-100 transition-all border border-transparent"
                >
                    <div className="flex items-center gap-3">
                        <LogOut size={18} />
                        <span className="font-medium">Sign Out</span>
                    </div>
                    {user?.phoneNumber && (
                        <span className="text-text-muted text-sm bg-bg-primary px-2 py-1 rounded-lg">
                            {lastFourDigits}
                        </span>
                    )}
                </button>
            </div>
        </div>
    )
}
