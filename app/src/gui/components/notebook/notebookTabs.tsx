/**
 * @file The tab chrome the notebook views share: a panel that renders only
 * while its tab is shown, and the props pairing a tab with that panel. Every
 * view tabs by slug (see `resolveTab`), so the ids are derived from the slug
 * rather than from an index.
 */
import {Box} from '@mui/material';
import React from 'react';

interface TabPanelProps {
  children?: React.ReactNode;
  /** The tab slug this panel belongs to. */
  tab: string;
  /** The tab slug currently shown. */
  value: string;
}

/**
 * TabPanel renders its children only while its tab is the one shown.
 */
export function TabPanel(props: TabPanelProps) {
  const {children, value, tab, ...other} = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== tab}
      id={`${tab}-tabpanel`}
      aria-labelledby={`${tab}-tab`}
      {...other}
    >
      {value === tab && <Box>{children}</Box>}
    </div>
  );
}

/**
 * a11yProps returns accessibility props for a tab, pairing it with its panel.
 */
export function a11yProps(tab: string) {
  return {
    id: `${tab}-tab`,
    'aria-controls': `${tab}-tabpanel`,
  };
}
