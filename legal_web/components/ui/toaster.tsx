"use client"

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, className, ...props }) {
        const isPromptRefine = className?.includes("prompt-refine-toast")

        return (
          <Toast key={id} className={className} {...props}>
            {isPromptRefine ? (
              <div className="min-w-0 flex-1">
                {title}
                {action && (
                  <div className="mt-1 flex w-full justify-end border-t border-border/60 pt-3">
                    {action}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="grid min-w-0 flex-1 gap-1 text-inherit">
                  {title && <ToastTitle className="text-inherit">{title}</ToastTitle>}
                  {description && (
                    <ToastDescription className="text-inherit opacity-90">{description}</ToastDescription>
                  )}
                </div>
                {action}
              </>
            )}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
