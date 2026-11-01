'use client';

import React from 'react';

export default function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex items-center justify-between w-full py-1.5">
      <span className="text-gray-700">{label}</span>
      <span className={`w-10 h-6 rounded-full p-0.5 transition-colors ${value ? 'bg-brand-500' : 'bg-gray-300'}`}>
        <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}
