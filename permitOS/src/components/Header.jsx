import React from 'react';
import { Badge } from './ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import {
  SignOut
} from '@phosphor-icons/react';

export default function Header({ activeTab, results, onLogout }) {
  const hasResults = !!results;

  return (
    <div className="bg-background border-b border-border sticky top-0 z-50">
      {/* Top bar */}
      <div className="flex items-center justify-end px-4 md:px-6 py-3 border-b border-border/60">
        <div className="flex items-center gap-2 flex-wrap">
          {hasResults && (
            <Badge variant="secondary" className="gap-1.5">
              <span className="w-2 h-2 bg-primary animate-pulse rounded-full" />
              Site Loaded
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1.5">
            <span className="w-2 h-2 bg-primary animate-pulse rounded-full" />
            Live Demo
          </Badge>
          <Badge variant="secondary" className="hidden sm:flex">
            EPA Regulatory Framework
          </Badge>
          {onLogout && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group/button inline-flex shrink-0 items-center justify-center h-8 gap-1.5 px-3 text-xs font-semibold tracking-widest uppercase transition-all hover:bg-muted hover:text-foreground rounded-none">
                  <SignOut className="w-4 h-4" weight="duotone" />
                  Logout
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onLogout} variant="destructive">
                  <SignOut className="w-4 h-4" weight="duotone" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}