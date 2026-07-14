import React from 'react';
import { Badge } from './ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import { SidebarTrigger, useSidebar } from './ui/sidebar';
import {
  SignOut, ShieldCheck as ShieldLogo, List
} from '@phosphor-icons/react';

export default function Header({ activeTab, results, onLogout }) {
  const hasResults = !!results;
  const { isMobile } = useSidebar();

  return (
    <div className="bg-background border-b border-border sticky top-0 z-50">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border/60">
        <div className="flex items-center gap-3">
          {isMobile && (
            <SidebarTrigger className="md:hidden">
              <List className="w-4 h-4" weight="duotone" />
            </SidebarTrigger>
          )}
          <div className="w-8 h-8 bg-primary flex items-center justify-center">
            <ShieldLogo className="w-4 h-4 text-primary-foreground" weight="duotone" />
          </div>
          <div>
            <span className="text-foreground font-semibold text-sm font-heading">Brick PermitOS</span>
            <span className="text-muted-foreground text-xs ml-2 hidden md:inline">— Data Center Permitting Intelligence</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasResults && (
            <Badge variant="secondary" className="gap-1.5">
              <span className="w-1.5 h-1.5 bg-primary animate-pulse" />
              Site Loaded
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1.5">
            <span className="w-1.5 h-1.5 bg-primary animate-pulse" />
            Live Demo
          </Badge>
          <Badge variant="secondary" className="hidden sm:flex">
            EPA Regulatory Framework
          </Badge>
          {onLogout && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group/button inline-flex shrink-0 items-center justify-center h-7 gap-1 px-3 text-xs font-semibold tracking-widest uppercase transition-all hover:bg-muted hover:text-foreground rounded-none">
                  <SignOut className="w-3 h-3" weight="duotone" />
                  Logout
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onLogout} variant="destructive">
                  <SignOut className="w-3.5 h-3.5" weight="duotone" />
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