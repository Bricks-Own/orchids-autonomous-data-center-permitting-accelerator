import React from 'react';
import { Check } from '@phosphor-icons/react';

const STEP_LABELS = ['Project Setup', 'Site Details', 'Review & Generate'];

export default function Stepper({ currentStep }) {
  return (
    <div className="bg-[#111113] border border-[#27272a] rounded-[14px] px-[26px] py-[18px]">
      <div className="flex items-center justify-center">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = stepNum < currentStep;
          const isUpcoming = stepNum > currentStep;

          return (
            <React.Fragment key={stepNum}>
              {/* Step circle + label */}
              <div className="flex items-center gap-3">
                {/* Circle */}
                <div
                  className={`w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    isActive
                      ? 'bg-[#fafafa] text-[#09090b]'
                      : isCompleted
                        ? 'bg-[#27272a] text-[#e4e4e7] border border-[#3f3f46]'
                        : 'bg-[#18181b] text-[#71717a] border border-[#27272a]'
                  }`}
                >
                  {isCompleted ? (
                    <Check weight="bold" size={16} />
                  ) : (
                    <span className="text-[13px] font-semibold">{stepNum}</span>
                  )}
                </div>
                {/* Label */}
                <span
                  className={`text-[12.5px] leading-tight ${
                    isActive
                      ? 'text-[#fafafa] font-bold'
                      : isCompleted
                        ? 'text-[#d4d4d8] font-medium'
                        : 'text-[#71717a] font-medium'
                  }`}
                >
                  {label}
                </span>
              </div>
              {/* Connector */}
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={`h-[1px] flex-1 min-w-[48px] mx-4 ${
                    isCompleted ? 'bg-[#3f3f46]' : 'bg-[#27272a]'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}