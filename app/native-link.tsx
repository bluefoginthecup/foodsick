import type { AnchorHTMLAttributes } from "react";

export function NativeLink({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props}>{children}</a>;
}
