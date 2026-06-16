import {Theme} from '@mui/material/styles';

export const buildSharedComponentOverrides = (theme: Theme) => ({
  MuiDataGrid: {
    styleOverrides: {
      root: {
        cursor: 'pointer',
        '& .MuiDataGrid-toolbarContainer': {
          padding: '8px 16px',
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: '#fafafa',
          width: '100%',
          '& .record-grid-toolbarContent': {
            width: '100%',
          },
          '& .record-grid-toolbarLayout': {
            display: 'flex',
            gap: theme.spacing(1),
            alignItems: 'center',
          },
          '& .record-grid-searchField': {
            flex: 1,
            minWidth: 0,
          },
          '& .record-grid-filterItem': {
            flexShrink: 0,
          },
          '& .record-grid-searchField .MuiOutlinedInput-root': {
            backgroundColor: '#ffffff',
            transition: 'all 0.3s ease-in-out',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            '&:hover': {
              borderColor: '#bdbdbd',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            },
            '&.Mui-focused': {
              borderColor: '#e0e0e0',
              boxShadow: 'none',
            },
          },
          '& .record-grid-searchField--active .MuiOutlinedInput-root': {
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
          },
          '& .record-grid-searchField .MuiOutlinedInput-input': {
            padding: '10px 14px',
            fontSize: '0.9rem',
            '&::placeholder': {
              color: '#757575',
              opacity: 0.8,
            },
          },
          '& .record-grid-searchButton': {
            color: theme.palette.primary.main,
            transition: 'all 0.3s ease-in-out',
            '&:hover': {
              backgroundColor: 'rgba(25, 118, 210, 0.08)',
              transform: 'scale(1.05)',
            },
          },
          '& .record-grid-searchButtonIcon': {
            color: theme.palette.primary.main,
            fontSize: '1.75rem',
            fontWeight: 'bold',
          },
          '& .record-grid-clearButton': {
            color: theme.palette.secondary.main,
            transition: 'all 0.3s',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
              color: '#424242',
            },
          },
          '& .record-grid-clearButtonIcon': {
            color: theme.palette.secondary.main,
            fontWeight: 'bold',
            fontSize: '1.60rem',
          },
          '& .record-grid-filterButton': {
            borderRadius: '8px',
            padding: '8px',
            minWidth: 'auto',
            backgroundColor: theme.palette.background.default,
            border: '2px solid #e0e0e0',
            transition: 'all 0.2s ease-in-out',
            textTransform: 'none',
            boxShadow: 'none',
            '&:hover': {
              backgroundColor: 'rgba(25, 118, 210, 0.08)',
              borderColor: theme.palette.primary.main,
            },
            '& .MuiButton-startIcon': {
              margin: 0,
            },
            '& .MuiButton-startIcon .MuiSvgIcon-root': {
              color: theme.palette.primary.main,
              fontSize: '1.85rem',
              fontWeight: 'bold',
            },
            '& .MuiButton-endIcon': {
              display: 'none',
            },
          },
        },
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
          padding: '24px 24px 0px 24px',
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
          '& .MuiDataGrid-toolbarContainer .record-grid-toolbarLayout': {
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: theme.spacing(1.5),
          },
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
  MuiDialogTitle: {
    styleOverrides: {
      root: {
        '&.faims-dialogTitle': {
          textAlign: 'center',
          paddingBottom: 0,
        },
        '& .faims-dialogHeader': {
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          marginBottom: theme.spacing(2),
        },
        '& .faims-dialogIcon': {
          marginBottom: theme.spacing(1),
        },
        '& .faims-dialogHeading': {
          fontWeight: theme.typography.fontWeightBold,
          textAlign: 'center',
        },
        '& .faims-dialogCloseButton': {
          position: 'absolute',
          top: theme.spacing(1),
          right: theme.spacing(1),
        },
      },
    },
  },
  MuiDialogActions: {
    styleOverrides: {
      root: {
        '&.dialog-actions-spread': {
          justifyContent: 'space-between',
        },
        '&.faims-dialogActions': {
          justifyContent: 'space-between',
          padding: theme.spacing(1),
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
