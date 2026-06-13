import { toast } from "@/hooks/use-toast";
import type { ToastActionElement } from "@/components/ui/toast";

/**
 * Show a success toast notification in Hebrew
 * @param message - The success message to display
 * @param action - Optional action element (e.g. a link button)
 */
export function showSuccessToast(message: string, action?: ToastActionElement) {
  toast({
    variant: "success",
    title: "הצלחה",
    description: message,
    action,
  });
}

/**
 * Show an error toast notification in Hebrew
 * @param message - The error message to display
 */
export function showErrorToast(message: string) {
  toast({
    variant: "destructive",
    title: "שגיאה",
    description: message,
  });
}
