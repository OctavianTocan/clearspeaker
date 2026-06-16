export function trimText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function trimOptionalText(value: unknown) {
  const text = trimText(value);

  return text || undefined;
}
