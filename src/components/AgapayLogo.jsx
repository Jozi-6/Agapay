import React from 'react';

export function AgapayLogo({ size = 40, className = '' }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background circle */}
      <circle cx="50" cy="50" r="48" fill="#667eea" fillOpacity="0.1"/>
      
      {/* Main plant/tree growth symbol */}
      <path 
        d="M50 85 L50 35" 
        stroke="#667eea" 
        strokeWidth="3" 
        strokeLinecap="round"
      />
      
      {/* Leaves representing growth */}
      <path 
        d="M50 35 Q65 25 75 35 Q65 45 50 35" 
        fill="#764ba2" 
        stroke="#667eea" 
        strokeWidth="2"
      />
      <path 
        d="M50 45 Q35 35 25 45 Q35 55 50 45" 
        fill="#764ba2" 
        stroke="#667eea" 
        strokeWidth="2"
      />
      <path 
        d="M50 25 Q70 15 80 25 Q70 35 50 25" 
        fill="#667eea" 
        stroke="#764ba2" 
        strokeWidth="2"
      />
      
      {/* Database/data symbol (stacked layers) */}
      <rect x="15" y="65" width="20" height="4" rx="1" fill="#667eea"/>
      <rect x="15" y="72" width="20" height="4" rx="1" fill="#667eea"/>
      <rect x="15" y="79" width="20" height="4" rx="1" fill="#667eea"/>
      
      {/* Community/people symbol */}
      <circle cx="85" cy="75" r="4" fill="#764ba2"/>
      <circle cx="85" cy="75" r="7" stroke="#667eea" strokeWidth="2" fill="none"/>
      
      {/* Agricultural tool symbol (simplified plow) */}
      <path 
        d="M70 75 L80 85 L75 85 L65 75 Z" 
        fill="#667eea"
      />
      
      {/* Connection lines representing network/community */}
      <path 
        d="M50 35 L85 75" 
        stroke="#667eea" 
        strokeWidth="1.5" 
        strokeDasharray="3 3"
        opacity="0.6"
      />
      <path 
        d="M50 45 L70 75" 
        stroke="#667eea" 
        strokeWidth="1.5" 
        strokeDasharray="3 3"
        opacity="0.6"
      />
      
      {/* Small dots representing data points */}
      <circle cx="30" cy="40" r="2" fill="#764ba2"/>
      <circle cx="25" cy="55" r="2" fill="#764ba2"/>
      <circle cx="35" cy="60" r="2" fill="#764ba2"/>
    </svg>
  );
}

export function AgapayLogoText({ className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <AgapayLogo size={32} />
      <div className="flex flex-col">
        <span className="text-xl font-bold text-gray-800" style={{ color: '#667eea' }}>
          AGAPAY
        </span>
        <span className="text-xs text-gray-600 tracking-wide">
          Agricultural Management System
        </span>
      </div>
    </div>
  );
}