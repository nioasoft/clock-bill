import { useEffect, useRef } from "react";

interface KeyboardShortcutOptions {
  /**
   * The key or key combination to trigger the callback.
   * Examples: "k", "Escape", "n", "Mod+k" (Cmd/Ctrl + k)
   */
  key: string;

  /**
   * Callback function to execute when the shortcut is triggered
   */
  callback: () => void;

  /**
   * Optional modifier keys that must be pressed together
   */
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;

  /**
   * Disable the shortcut
   */
  disabled?: boolean;

  /**
   * Additional keyboard event options
   */
  preventDefault?: boolean;
}

/**
 * React hook for handling keyboard shortcuts
 *
 * @example
 * // Simple key press
 * useKeyboardShortcut({ key: "k", callback: () => console.log("k pressed") });
 *
 * @example
 * // Cmd/Ctrl + k
 * useKeyboardShortcut({
 *   key: "k",
 *   ctrlKey: true,
 *   callback: () => console.log("Cmd/Ctrl + k pressed")
 * });
 *
 * @example
 * // Escape key to close modal
 * useKeyboardShortcut({
 *   key: "Escape",
 *   callback: () => setShowModal(false)
 * });
 */
export function useKeyboardShortcut({
  key,
  callback,
  metaKey = false,
  ctrlKey = false,
  shiftKey = false,
  altKey = false,
  disabled = false,
  preventDefault = true,
}: KeyboardShortcutOptions) {
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.key || !key) return;

      // Skip single-key shortcuts (no modifiers) when user is typing in a form field
      const hasModifier = metaKey || ctrlKey || shiftKey || altKey;
      if (!hasModifier) {
        const target = event.target as HTMLElement;
        const tagName = target.tagName;
        if (
          tagName === "INPUT" ||
          tagName === "TEXTAREA" ||
          tagName === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      // Check if the key matches
      const keyMatches = event.key.toLowerCase() === key.toLowerCase();

      // Check modifiers
      const metaMatches = event.metaKey === metaKey;
      const ctrlMatches = event.ctrlKey === ctrlKey;
      const shiftMatches = event.shiftKey === shiftKey;
      const altMatches = event.altKey === altKey;

      // Handle Cmd on macOS and Ctrl on Windows/Linux as equivalent
      const isModKey = metaKey || ctrlKey;
      const modKeyMatches = isModKey ? (event.metaKey || event.ctrlKey) : !event.metaKey && !event.ctrlKey;

      // Only trigger if all conditions match
      if (
        keyMatches &&
        modKeyMatches &&
        shiftMatches &&
        altMatches &&
        !event.repeat // Prevent repeated firing when holding key
      ) {
        if (preventDefault) {
          event.preventDefault();
        }

        callbackRef.current();
      }
    };

    // Add event listener to window
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [key, metaKey, ctrlKey, shiftKey, altKey, disabled, preventDefault]);
}
