import React from 'react';
import { Info } from 'lucide-react';

export function RSBSADisclaimer({ className = '' }) {
  return (
    <div className={`flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg ${className}`}>
      <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-blue-800 leading-relaxed">
        RSBSA information maintained by OMAG for local administrative purposes.
      </p>
    </div>
  );
}