export const capitalizeWords = (value = "") => {
  const text = String(value).trim();
  if (!text) return "";
  return text.replace(/\b[a-z]/g, (char) => char.toUpperCase());
};
