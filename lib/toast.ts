import { toast } from "@/hooks/use-toast";

/**
 * Show a success toast notification in Hebrew
 * @param message - The success message to display
 */
export function showSuccessToast(message: string) {
  toast({
    variant: "success",
    title: "הצלחה",
    description: message,
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

/**
 * Show an info toast notification in Hebrew
 * @param title - The title of the toast
 * @param message - The message to display
 */
export function showInfoToast(title: string, message?: string) {
  toast({
    variant: "default",
    title,
    description: message,
  });
}
