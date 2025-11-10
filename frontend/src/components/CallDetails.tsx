"use client";

import { CallDetails } from "../lib/types";
import { X } from "lucide-react";
import { BotIcon, UserIcon } from "./Icons";

interface CallDetailsProps {
    selectedCall: CallDetails;
    setSelectedCall: (call: CallDetails | null) => void;
}

export default function CallDetailsPanel({ selectedCall, setSelectedCall }: CallDetailsProps) {
    return (
        <div className="bg-bg-secondary p-4 flex flex-col border-t border-border flex-1 min-h-0">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-xl font-semibold text-text-light">Call Details</h2>
                <button onClick={() => setSelectedCall(null)} className="text-text-muted hover:text-text-light">
                    <X className="h-6 w-6" />
                </button>
            </div>
            <div className="overflow-y-auto overflow-x-hidden space-y-4 -mr-2 pr-2">
                <div>
                    <h3 className="font-semibold text-text-light break-words">{selectedCall.biz_name}</h3>
                    <p className="text-sm text-text-muted">{selectedCall.phone_number}</p>
                </div>
                <div className="border-t border-border pt-4">
                    <h4 className="font-semibold text-text-light mb-2 px-4">Transcript</h4>
                    <div className="space-y-3 text-sm px-4">
                        {selectedCall.transcript?.map((entry, index) => (
                            <div key={index} className={`flex items-end gap-2 ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {entry.role !== 'user' && <div className="p-1.5 bg-accent-blue rounded-full border border-border shadow-sm"><BotIcon className="h-4 w-4 text-white" /></div>}
                                <div className={`p-3 rounded-lg max-w-xs shadow-sm ${entry.role === 'user' ? 'bg-accent-blue text-white rounded-br-none' : 'bg-bg-tertiary text-text-light rounded-bl-none'}`}>
                                    <p className="break-words">{entry.text}</p>
                                </div>
                                {entry.role === 'user' && <div className="p-1.5 bg-bg-tertiary rounded-full border border-border shadow-sm"><UserIcon className="h-4 w-4 text-text-light" /></div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
