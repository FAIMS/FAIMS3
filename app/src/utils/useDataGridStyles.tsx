/**
 * @file useDataGridStyles.tsx
 * @description
 *   This file defines a shared styling hook for customizing the appearance of
 *   MUI's DataGrid component across the application. It encapsulates styling rules
 *   for headers, rows, cells, pagination, and responsive behavior to ensure consistent
 *   theming and layout in tables like RecordsTable.
 *
 *   The styles defined here follow the FAIMS design system using the current MUI theme,
 *   and include responsive padding, hover interactions, visual enhancements,
 *   and conditional styling for special rows (e.g., conflict rows).
 */
/**
 * Generates a consistent and responsive style object for MUI DataGrids using the provided theme.
 *
 * @returns {object} - An object containing style definitions for root, wrapper, and grid sub-elements.
 */
export const useDataGridStyles = () => ({
  root: {
    border: 'none',
  },
  wrapper: {
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  },
  grid: {},
});
