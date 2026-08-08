import { isValidElement, type ReactNode } from "react";

// custom-table.md §6 / §14 — pulls plain text out of JSX cells so search
// (startsWith highlight) and the sortingFn fallback can compare on text
// content rather than markup.
export function extractTextFromReactNode(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);

  if (Array.isArray(node)) {
    return node.map(extractTextFromReactNode).join(" ");
  }

  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return extractTextFromReactNode(props?.children);
  }

  return "";
}
