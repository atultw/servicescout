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
    <div className="bg-white rounded-2xl shadow-xl px-3 py-2 flex flex-col flex-1 min-h-0">
            <div className="flex justify-between items-center mb-2 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800">Call Details</h2>
                <button onClick={() => setSelectedCall(null)} className="text-gray-400 hover:text-gray-700">
                    <X className="h-6 w-6" />
                </button>
            </div>
            <div className="overflow-y-auto overflow-x-hidden space-y-6 pr-2">
                <div>
                    <h3 className="font-semibold text-gray-700 break-words text-lg mb-1">{selectedCall.biz_name}</h3>
                    <p className="text-sm text-gray-500 mb-2">{selectedCall.phone_number}</p>
                </div>
                <div className="pt-6">
                    <h4 className="font-semibold text-gray-700 mb-4 px-2">Transcript</h4>
                    <div className="space-y-4 text-sm px-2">
                        {selectedCall.transcript?.map((entry, index) => (
                            <div key={index} className={`flex items-end gap-3 ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {entry.role !== 'user' && <div className="p-2 bg-blue-500 rounded-full border border-gray-200 shadow-sm"><BotIcon className="h-4 w-4 text-white" /></div>}
                                <div className={`p-4 rounded-xl max-w-xs shadow-sm ${entry.role === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-blue-50 text-gray-700 rounded-bl-none'}`}>
                                    <p className="break-words">{entry.text}</p>
                                </div>
                                {entry.role === 'user' && <div className="p-2 bg-blue-50 rounded-full border border-gray-200 shadow-sm"><UserIcon className="h-4 w-4 text-gray-700" /></div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
