"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "#ffffff",
          "--normal-text": "#18181b",
          "--normal-border": "#e4e4e7",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "rounded-lg! border! shadow-md! text-sm! font-medium! px-4! py-3!",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
