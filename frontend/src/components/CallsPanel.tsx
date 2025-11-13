"use client";

import { Call } from "../lib/types";
import { Phone, Clock, CheckCircle, XCircle } from "lucide-react";

export default function CallsPanel({ calls, handleSelectCall, selectedCall }: {
    calls: Call[];
    handleSelectCall: (call: Call) => void;
    selectedCall: Call | null;
}) {
    return (
    <div className="h-full flex flex-col bg-white p-2">
            {/* Header */}
            <div className="pb-2 mb-2">
                <div className="flex items-center gap-3">
                    <div className="bg-gray-100 p-2 rounded-lg">
                        <Phone className="h-5 w-5 text-blue-500" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-800">Recent Calls</h2>
                </div>
            </div>

            {/* Calls List */}
            <div className="flex-1 overflow-y-auto scroll-smooth space-y-3">
                {calls.map((call) => (
                    <div
                        key={call.call_id}
                        onClick={() => handleSelectCall(call)}
                        className={`p-4 rounded-xl cursor-pointer transition-all border-2 hover:shadow-md ${
                            selectedCall?.call_id === call.call_id
                                ? 'bg-blue-100 border-blue-500 shadow-md'
                                : 'bg-blue-50 border-gray-200 hover:border-blue-300'
                        }`}
                    >
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold text-gray-700 text-sm">{call.biz_name}</h3>
                            <div
                                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                    call.success === null
                                        ? 'bg-orange-100 text-orange-700'
                                        : call.success
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                }`}
                            >
                                {call.success === null ? (
                                    <><Clock size={12} /> Pending</>
                                ) : call.success ? (
                                    <><CheckCircle size={12} /> Success</>
                                ) : (
                                    <><XCircle size={12} /> Failed</>
                                )}
                            </div>
                        </div>

                        <p className="text-xs text-gray-500 mb-2 font-mono bg-blue-50 px-2 py-1 rounded">
                            {call.phone_number}
                        </p>

                        {call.outcome_summary && (
                            <p className="text-sm text-gray-700 leading-relaxed">
                                {call.outcome_summary}
                            </p>
                        )}
                    </div>
                ))}

                {calls.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="bg-blue-50 p-4 rounded-xl mb-4">
                            <Phone className="h-8 w-8 text-blue-300" />
                        </div>
                        <p className="text-gray-400 font-medium">No calls yet</p>
                        <p className="text-gray-400 text-sm mt-1">
                            Start a conversation to see calls appear here
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
