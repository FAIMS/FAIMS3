import React from 'react';
import {
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Radio,
  RadioGroup,
  FormControlLabel,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

type FieldProtectionMenuProps = {
  anchorEl: HTMLElement | null;
  menuOpen: boolean;
  onClose: () => void;
  protection: 'protected' | 'none' | 'allow-hiding';
  onToggleProtection: (
    event: React.ChangeEvent<HTMLInputElement>,
    newProtection: 'protected' | 'none' | 'allow-hiding'
  ) => void;
  required: boolean;
};

export const FieldProtectionMenu: React.FC<FieldProtectionMenuProps> = ({
  anchorEl,
  menuOpen,
  onClose,
  protection,
  onToggleProtection,
  required,
}) => {
  return (
    <Menu
      anchorEl={anchorEl}
      open={menuOpen}
      onClose={onClose}
      PaperProps={{
        style: {
          maxHeight: 300,
          width: '260px',
          padding: '16px',
          borderRadius: '6px',
          boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.1)',
        },
      }}
      onClick={e => e.stopPropagation()}
    >
      <Typography
        variant="subtitle2"
        align="center"
        sx={{
          fontWeight: 600,
          marginBottom: '0px',
          color: '#37474f',
        }}
      >
        Field Protection
      </Typography>
      <Typography
        variant="caption"
        align="center"
        sx={{
          fontWeight: 400,
          marginBottom: '0px',
          lineHeight: 1.4,
          color: '#607d8b',
        }}
      >
        Only change this if you are sure you have permission.
      </Typography>
      <Divider sx={{marginTop: '20px', marginBottom: '10px'}} />

      <RadioGroup
        value={protection}
        onChange={e =>
          onToggleProtection(
            e as React.ChangeEvent<HTMLInputElement>,
            e.target.value as 'none' | 'allow-hiding' | 'protected'
          )
        }
      >
        <MenuItem disableRipple sx={{padding: '6px 12px'}}>
          <FormControlLabel
            value="none"
            control={<Radio size="small" />}
            label={
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2" sx={{color: '#37474f'}}>
                  No Protection
                </Typography>
                <Tooltip
                  title="The field can be freely modified or deleted."
                  arrow
                >
                  <IconButton size="small">
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            }
          />
        </MenuItem>

        {!required && (
          <MenuItem disableRipple sx={{padding: '6px 12px'}}>
            <FormControlLabel
              value="allow-hiding"
              control={<Radio size="small" />}
              label={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body2" sx={{color: '#37474f'}}>
                    Allow Hiding
                  </Typography>
                  <Tooltip
                    title="The field can be hidden but not modified or deleted."
                    arrow
                  >
                    <IconButton size="small">
                      <InfoOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              }
            />
          </MenuItem>
        )}

        <MenuItem disableRipple sx={{padding: '6px 12px'}}>
          <FormControlLabel
            value="protected"
            control={<Radio size="small" />}
            label={
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2" sx={{color: '#37474f'}}>
                  Full Protection
                </Typography>
                <Tooltip title="The field cannot be modified or deleted." arrow>
                  <IconButton size="small">
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            }
          />
        </MenuItem>
      </RadioGroup>
    </Menu>
  );
};
