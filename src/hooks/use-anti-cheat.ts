import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';

interface AntiCheatOptions {
  onAutoSubmit?: () => void;
  enabled?: boolean;
}

export function useAntiCheat({ onAutoSubmit, enabled = true }: AntiCheatOptions = {}) {
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const onAutoSubmitRef = useRef(onAutoSubmit);
  onAutoSubmitRef.current = onAutoSubmit;

  useEffect(() => {
    if (!enabled) return;

    // Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      toast.warning('Right-click is disabled during the test.', { duration: 2000 });
    };

    // Detect tab switching / visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount(prev => {
          const newCount = prev + 1;
          if (newCount >= 3) {
            toast.error('Test auto-submitted due to repeated tab switching.', { duration: 5000 });
            setTimeout(() => onAutoSubmitRef.current?.(), 500);
          } else {
            toast.warning(
              `Warning: Tab switch detected (${newCount}/3). Your test will be auto-submitted after 3 switches.`,
              { duration: 4000 }
            );
          }
          return newCount;
        });
      }
    };

    // Disable common keyboard shortcuts for copy
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'a' || e.key === 'u')) {
        // Allow in input/textarea for typing, but block copy
        if (e.key === 'c' || e.key === 'v' || e.key === 'a') {
          const target = e.target as HTMLElement;
          const isWritingArea = target.tagName === 'TEXTAREA';
          // Allow select-all and basic editing in writing textarea, but not copy/paste
          if (e.key === 'a' && isWritingArea) return;
          if (e.key !== 'a') {
            e.preventDefault();
            toast.warning('Copy/paste is disabled during the test.', { duration: 2000 });
          }
        }
        if (e.key === 'u') {
          e.preventDefault();
        }
      }
    };

    // Disable drag/selection on passage text
    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      // Allow selection in reading passages but not copy
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);

  return { tabSwitchCount };
}
