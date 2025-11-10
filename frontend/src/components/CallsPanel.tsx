"use client";

import { Call } from "../lib/types";
import { Phone, Clock, CheckCircle, XCircle } from "lucide-react";

interface CallsPanelProps {
    calls: Call[];
    selectedCall: Call | null;
    handleSelectCall: (call: Call) => void;
}

export default function CallsPanel({ calls, selectedCall, handleSelectCall }: CallsPanelProps) {
    return (
        <div className="h-full flex flex-col bg-bg-secondary">
            {/* Header */}
            <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="bg-accent-blue p-2 rounded-lg">
                        <Phone className="h-5 w-5 text-text-light" />
                    </div>
                    <h2 className="text-lg font-bold text-text-light">Recent Calls</h2>
                </div>
            </div>

            {/* Calls List */}
            <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
                <div className="space-y-3">
                    {calls.map(call => (
                        <div 
                            key={call.call_id} 
                            onClick={() => handleSelectCall(call)} 
                            className={`p-4 rounded-xl cursor-pointer transition-all border-2 hover:shadow-md ${
                                selectedCall?.call_id === call.call_id 
                                    ? 'bg-accent-blue-lighter border-accent-blue shadow-md' 
                                    : 'bg-bg-primary border-border hover:border-accent-blue/30'
                            }`}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <h3 className="font-semibold text-text-light text-sm">{call.biz_name}</h3>
                                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                    call.success === null 
                                        ? 'bg-orange-100 text-orange-700' 
                                        : call.success 
                                            ? 'bg-green-100 text-green-700' 
                                            : 'bg-red-100 text-red-700'
                                }`}>
                                    {call.success === null ? (
                                        <><Clock size={12} /> Pending</>
                                    ) : call.success ? (
                                        <><CheckCircle size={12} /> Success</>
                                    ) : (
                                        <><XCircle size={12} /> Failed</>
                                    )}
                                </div>
                            </div>
                            
                            <p className="text-xs text-text-muted mb-2 font-mono bg-bg-tertiary px-2 py-1 rounded">
                                {call.phone_number}
                            </p>
                            
                            {call.outcome_summary && (
                                <p className="text-sm text-text-light leading-relaxed">
                                    {call.outcome_summary}
                                </p>
                            )}
                        </div>
                    ))}

                    {calls.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="bg-bg-tertiary p-4 rounded-xl mb-4">
                                <Phone className="h-8 w-8 text-text-muted" />
                            </div>
                            <p className="text-text-muted font-medium">No calls yet</p>
                            <p className="text-text-muted text-sm mt-1">
                                Start a conversation to see calls appear here
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
