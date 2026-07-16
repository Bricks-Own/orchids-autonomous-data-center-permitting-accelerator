import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Check, CaretDown } from '@phosphor-icons/react';

export default function PermitModuleAccordion({ type, title, modules, accentColor, renderExtra }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className={`text-xs font-semibold uppercase tracking-wider ${accentColor || 'text-primary'}`}>
          {title || 'Modules & Deliverables'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {modules.map(mod => {
            const isOpen = expanded === mod.id;
            return (
              <div key={mod.id} className="border border-border/40 overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : mod.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground/80">{mod.name || mod.title}</div>
                    <div className="text-xs text-muted-foreground/70">
                      {mod.citations?.[0] || mod.regulation || ''}
                    </div>
                  </div>
                  <CaretDown
                    weight="bold"
                    size={14}
                    className={`text-muted-foreground/70 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-border/40 p-3 bg-card/40 space-y-3">
                    {/* Citations */}
                    {mod.citations && mod.citations.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Regulatory Citations</p>
                        <div className="flex flex-wrap gap-1">
                          {mod.citations.map(c => (
                            <span key={c} className="text-xs bg-primary/20 text-primary border border-primary/30 px-2 py-0.5">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Deliverables */}
                    {(mod.deliverables || []).length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Auto-Generated Deliverables</p>
                        <ul className="space-y-1">
                          {mod.deliverables.map(d => (
                            <li key={d} className="text-xs text-muted-foreground flex gap-2">
                              <Check weight="bold" size={12} className="text-primary mt-0.5 flex-shrink-0" />
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* AI Acceleration */}
                    {mod.aiAcceleration && (
                      <div className={`p-2.5 border ${accentColor ? 'border-primary/30' : 'border-primary/30'}`}>
                        <p className={`text-xs ${accentColor || 'text-primary'}`}>
                          <span className="font-semibold">AI Acceleration:</span> {mod.aiAcceleration}
                        </p>
                      </div>
                    )}

                    {/* Module-specific extra content */}
                    {renderExtra && renderExtra(mod, isOpen)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}