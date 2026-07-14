import React from 'react';
import { Check } from '@phosphor-icons/react';

const STEP_LABELS = ['Project Setup', 'Site Details', 'Review & Generate'];

export default function Stepper({ currentStep }) {
  return (
    <div className="bg-card border border-border">
      <div className="flex items-center justify-center px-6 py-4">
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
                  className={`w-[30px] h-[30px] flex items-center justify-center flex-shrink-0 transition-all ${
                    isActive
                      ? 'bg-foreground text-background'
                      : isCompleted
                        ? 'bg-muted text-foreground border border-border'
                        : 'bg-background text-muted-foreground border border-border'
                  }`}
                >
                  {isCompleted ? (
                    <Check weight="bold" size={16} />
                  ) : (
                    <span className="text-sm font-semibold">{stepNum}</span>
                  )}
                </div>
                {/* Label */}
                <span
                  className={`text-xs leading-tight ${
                    isActive
                      ? 'text-foreground font-bold'
                      : isCompleted
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground font-medium'
                  }`}
                >
                  {label}
                </span>
              </div>
              {/* Connector */}
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={`h-px flex-1 min-w-[48px] mx-4 ${
                    isCompleted ? 'bg-border' : 'bg-muted'
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