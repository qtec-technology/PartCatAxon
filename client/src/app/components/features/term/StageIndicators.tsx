import { AlertTriangle, Check } from 'lucide-react';
import type { TermStageStatus } from '../../../types/term_form.types';

interface StageIndicatorsProps {
  status: TermStageStatus;
}

const STAGES: Array<{ key: keyof TermStageStatus; label: string; title: string }> = [
  { key: 'OP1', label: 'OP1', title: 'Order Price' },
  { key: 'FR', label: 'FR', title: 'Freight' },
  { key: 'INS', label: 'INS', title: 'Insurance' },
  { key: 'CIF', label: 'CIF', title: 'CIF' },
  { key: 'DT', label: 'DT', title: 'Duty Tax' },
  { key: 'ET', label: 'ET', title: 'Excise Tax' },
  { key: 'MT', label: 'MT', title: 'Municipal Tax' },
  { key: 'TERM', label: 'TERM', title: 'Term Info' },
  { key: 'UOM', label: 'UOM', title: 'Unit of Measure' },
  { key: 'QLC', label: 'QLC', title: 'QTEC Landed Cost' },
];

export function StageIndicators({ status }: StageIndicatorsProps) {
  return (
    <nav className="bg-white px-6 py-3 border-b border-gray-200 overflow-x-auto shadow-sm mb-6" aria-label="Calculation stage progress">
      <ol className="flex items-center gap-3 min-w-max mx-auto justify-center">
        <li className="text-xs text-gray-400 font-bold uppercase tracking-wider mr-2">Stage:</li>
        {STAGES.map((stage, idx) => {
          const isComplete = status[stage.key];
          return (
            <li key={stage.key} className="flex items-center gap-3">
              <span
                aria-label={`${stage.title}: ${isComplete ? 'complete' : 'pending'}`}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  isComplete
                    ? 'bg-green-50 text-term-green border-term-green shadow-sm'
                    : 'bg-gray-50 text-gray-400 border-gray-200'
                }`}
              >
                {isComplete ? (
                  <span className="bg-term-green rounded-full p-0.5" aria-hidden="true">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </span>
                ) : (
                  <span className="bg-gray-200 rounded-full p-0.5" aria-hidden="true">
                    <AlertTriangle className="w-2.5 h-2.5 text-gray-400" />
                  </span>
                )}
                {stage.label}
              </span>
              {idx < STAGES.length - 1 && <span className="w-4 h-0.5 bg-gray-200 rounded-full" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
