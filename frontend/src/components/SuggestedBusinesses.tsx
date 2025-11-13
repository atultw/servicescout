"use client";

import { Business } from "../lib/types";
import { Star, MapPin, Phone, Users } from "lucide-react";

interface SuggestedBusinessesProps {
    candidates: Business[];
}

export default function SuggestedBusinesses({ candidates }: SuggestedBusinessesProps) {
    console.log('SuggestedBusinesses render - candidates:', candidates);
    if (!candidates || candidates.length === 0) {
        return null;
    }

    return (
    <div className="px-3 py-2 border-b border-blue-200 flex-shrink-0 rounded-2xl">
            <div className="w-full">
                {/* Improved horizontal scrolling container */}
                <div className="relative">
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-blue-300/30 scrollbar-track-transparent">
                        {candidates.map((biz, index) => (
                            <div key={`business-${index}-${biz.phone_number}`} className="bg-white rounded-2xl px-6 py-5 flex-shrink-0 w-80 shadow-xl border border-gray-200 hover:shadow-2xl transition-all duration-200 hover:scale-105">
                                {biz.picture && (
                                    <div className="w-full h-36 mb-4 overflow-hidden rounded-lg bg-gray-100">
                                        <img 
                                            src={biz.picture} 
                                            alt={biz.name} 
                                            className="w-full h-full object-cover" 
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                )}
                                
                                <div className="space-y-3">
                                    <h4 className="font-bold text-gray-800 text-lg line-clamp-2">{biz.name}</h4>
                                    
                                    {biz.address && (
                                        <div className="flex items-start gap-2 text-gray-500">
                                            <MapPin size={16} className="mt-0.5 flex-shrink-0" />
                                            <p className="text-sm line-clamp-2">{biz.address}</p>
                                        </div>
                                    )}
                                    
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <Phone size={16} className="flex-shrink-0" />
                                        <p className="text-sm font-mono">{biz.phone_number}</p>
                                    </div>
                                    
                                    {biz.rating !== undefined && biz.rating !== null && (
                                        <div className="flex items-center gap-3 pt-2">
                                            <div className="flex items-center gap-1 bg-orange-400 text-white px-2 py-1 rounded-full">
                                                <Star size={14} fill="currentColor" />
                                                <span className="text-sm font-bold">{biz.rating.toFixed(1)}</span>
                                            </div>
                                            {biz.review_count !== undefined && biz.review_count !== null && (
                                                <span className="text-sm text-gray-500">
                                                    ({biz.review_count} reviews)
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {/* Visual indicator for more content if scrollable */}
                    {candidates.length > 3 && (
                        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none rounded-r-2xl"></div>
                    )}
                </div>
            </div>
        </div>
    )
}
