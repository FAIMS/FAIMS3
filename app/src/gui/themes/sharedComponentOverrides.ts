import {Theme} from '@mui/material/styles';

export const buildSharedComponentOverrides = (theme: Theme) => ({
  MuiDataGrid: {
    styleOverrides: {
      root: {
        cursor: 'pointer',
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
        '& .MuiDataGrid-cell': {
          padding: '16px 24px',
          borderBottom: `1px solid ${theme.palette.divider}`,
          '&:focus, &:focus-within': {outline: 'none'},
        },
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
        '& .MuiTypography-root': {
          lineHeight: 1.5,
        },
        [theme.breakpoints.down('sm')]: {
          '& .MuiDataGrid-columnHeaders .MuiDataGrid-columnHeader': {
            padding: '12px 16px',
          },
          '& .MuiDataGrid-cell': {
            padding: '12px 16px',
          },
        },
      },
    },
  },
  MuiTablePagination: {
    styleOverrides: {
      displayedRows: {
        fontWeight: 600,
      },
    },
  },
});
