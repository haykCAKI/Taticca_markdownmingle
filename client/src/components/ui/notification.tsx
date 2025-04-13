import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const notificationVariants = cva(
  "fixed bottom-4 right-4 px-4 py-3 rounded-md shadow-md flex items-center z-50 transition-opacity duration-300 ease-in-out",
  {
    variants: {
      variant: {
        default: "bg-background border border-border text-foreground",
        success: "bg-green-100 border border-green-200 text-green-800",
        error: "bg-red-100 border border-red-200 text-red-800",
        warning: "bg-yellow-100 border border-yellow-200 text-yellow-800",
        info: "bg-blue-100 border border-blue-200 text-blue-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface NotificationProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof notificationVariants> {
  message: string;
  open?: boolean;
  onClose?: () => void;
  autoClose?: boolean;
  autoCloseTime?: number;
  icon?: React.ReactNode;
}

const Notification = React.forwardRef<HTMLDivElement, NotificationProps>(
  (
    {
      className,
      variant,
      message,
      open = false,
      onClose,
      autoClose = true,
      autoCloseTime = 3000,
      icon,
      ...props
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = React.useState(open);

    React.useEffect(() => {
      setIsVisible(open);
    }, [open]);

    React.useEffect(() => {
      if (isVisible && autoClose) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          if (onClose) onClose();
        }, autoCloseTime);

        return () => {
          clearTimeout(timer);
        };
      }
    }, [isVisible, autoClose, autoCloseTime, onClose]);

    if (!isVisible) return null;

    return (
      <div
        ref={ref}
        className={cn(notificationVariants({ variant }), className)}
        {...props}
      >
        {icon && <span className="mr-2">{icon}</span>}
        <span>{message}</span>
        {onClose && (
          <button
            className="ml-4 text-current hover:opacity-70"
            onClick={() => {
              setIsVisible(false);
              onClose();
            }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);

Notification.displayName = "Notification";

export { Notification };
