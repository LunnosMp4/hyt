/**
 * Convert a string to PascalCase
 * Example: "my-plugin-name" -> "MyPluginName"
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}
