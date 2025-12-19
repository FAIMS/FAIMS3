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
import {Theme} from '@mui/material/styles';

/**
 * Generates a consistent and responsive style object for MUI DataGrids using the provided theme.
 *
 * @param {Theme} theme - The current MUI theme used to access colors, breakpoints, spacing, etc.
 * @returns {object} - An object containing style definitions for root, wrapper, and grid sub-elements.
 */
export const useDataGridStyles = (theme: Theme) => ({
  root: {
    border: 'none',
  },
  wrapper: {
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  },
  grid: {
    cursor: 'pointer',
    // Column Header Styling
    '& .MuiDataGrid-columnHeaders': {
      backgroundColor: theme.palette.grey[100],
      borderBottom: `2px solid ${theme.palette.grey[200]}`,
      minHeight: '60px !important',
      '& .MuiDataGrid-columnHeader': {
        padding: '16px 24px',
        '&:focus, &:focus-within': {outline: 'none'},
      },
      '& .MuiDataGrid-columnHeaderTitle': {
        fontWeight: 600,
        fontSize: '0.95rem',
        color: theme.palette.text.primary,
        letterSpacing: '0.01em',
      },
      '& .MuiDataGrid-columnSeparator': {
        display: 'none',
      },
      '& .MuiDataGrid-sortIcon': {
        color: theme.palette.text.secondary,
        opacity: 1,
      },
    },
    // Row Styling
    '& .MuiDataGrid-row': {
      minHeight: '80px !important',
      '&:hover': {
        backgroundColor: theme.palette.action.hover,
        transition: 'background-color 0.2s ease',
      },
      '&.conflict-row': {
        backgroundColor: theme.palette.warning.light,
        '&:hover': {
          backgroundColor: theme.palette.warning.light,
          opacity: 0.95,
        },
      },
    },
    // Cell Styling
    '& .MuiDataGrid-cell': {
      padding: '16px 24px',
      borderBottom: `1px solid ${theme.palette.divider}`,
      '&:focus, &:focus-within': {outline: 'none'},
    },
    // Footer & Pagination
    '& .MuiDataGrid-footerContainer': {
      minHeight: '56px',
      padding: '8px 16px',
      borderTop: `1px solid ${theme.palette.divider}`,
      backgroundColor: theme.palette.background.paper,
    },
    '& .MuiTablePagination-root': {
      color: theme.palette.text.secondary,
      '& .MuiTablePagination-select': {marginRight: 2},
      '& .MuiTablePagination-selectLabel': {marginRight: 8},
      '& .MuiTablePagination-displayedRows': {marginLeft: 8},
    },
    // Typography Fixes
    '& .MuiTypography-root': {
      lineHeight: 1.5,
    },
    // Responsive Adjustments for Small Screens
    [theme.breakpoints.down('sm')]: {
      '& .MuiDataGrid-columnHeaders .MuiDataGrid-columnHeader': {
        padding: '12px 16px',
      },
      '& .MuiDataGrid-cell': {
        padding: '12px 16px',
      },
    },
  },
});
