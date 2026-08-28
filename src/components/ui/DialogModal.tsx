import React, { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { springTactile } from '../../lib/motion/springs';

export interface DialogModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidthClass?: string;
  showCloseButton?: boolean;
  headerContent?: ReactNode;
}

/**
 * Universal accessible modal wrapper built on top of Radix UI Dialog primitives.
 * Provides standard WCAG 2.1 AA/AAA compliance:
 * - Traps focus inside the active dialog
 * - Sets role="dialog" and aria-modal="true"
 * - Listens for Escape key dismissal
 * - Restores focus to the triggering element on unmount
 * - Hardware-accelerated tactile spring animations
 */
export const DialogModal: React.FC<DialogModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidthClass = 'max-w-lg',
  showCloseButton = true,
  headerContent,
}) => {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={springTactile.gentle}
                className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md"
              />
            </Dialog.Overlay>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pointer-events-none">
              <Dialog.Content asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 16 }}
                  transition={springTactile.snappy}
                  className={`w-full ${maxWidthClass} bg-surface border border-border-strong rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] pointer-events-auto`}
                >
                  <div className="p-4 sm:p-5 border-b border-border-subtle flex items-center justify-between shrink-0">
                    <div className="flex-1 pr-2">
                      <Dialog.Title className="text-base sm:text-lg font-bold text-text-primary">
                        {title}
                      </Dialog.Title>
                      {description && (
                        <Dialog.Description className="text-xs text-text-secondary mt-0.5">
                          {description}
                        </Dialog.Description>
                      )}
                      {headerContent}
                    </div>
                    {showCloseButton && (
                      <Dialog.Close asChild>
                        <button
                          type="button"
                          aria-label="Sulje"
                          className="p-1.5 rounded-lg hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                        >
                          <X className="w-5 h-5" aria-hidden="true" />
                        </button>
                      </Dialog.Close>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                    {children}
                  </div>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
};
