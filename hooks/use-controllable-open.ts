"use client";

import { useCallback, useState } from "react";

/**
 * Lets a dialog component work either uncontrolled (own state, used with a
 * trigger) or controlled (parent passes open / onOpenChange).
 */
export function useControllableOpen(
  open?: boolean,
  onOpenChange?: (open: boolean) => void,
) {
  const [internal, setInternal] = useState(false);
  const isControlled = open !== undefined;

  const setOpen = useCallback(
    (value: boolean) => {
      if (!isControlled) setInternal(value);
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange],
  );

  return { open: isControlled ? open : internal, setOpen };
}
