import React from 'react';
import TextFieldsRoundedIcon from '@mui/icons-material/TextFieldsRounded';
import LooksOneRoundedIcon from '@mui/icons-material/LooksOneRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import InsertPhotoRoundedIcon from '@mui/icons-material/InsertPhotoRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import RemoveRedEyeRoundedIcon from '@mui/icons-material/RemoveRedEyeRounded';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';

export enum CategoryKey {
  TEXT = 'text',
  NUMBERS = 'numbers',
  DATETIME = 'dateTime',
  MEDIA = 'media',
  LOCATION = 'location',
  CHOICE = 'choice',
  RELATIONSHIP = 'relationship',
  DISPLAY = 'display',
  ALL = 'all',
}

export interface CategoryConfig {
  key: CategoryKey;
  displayName: string;
  icon: React.ReactElement;
  order: number;
}

/**
 * Map every CategoryKey to its metadata.
 */
export const CategoryConfigMap: Record<CategoryKey, CategoryConfig> = {
  [CategoryKey.ALL]: {
    key: CategoryKey.ALL,
    displayName: 'All',
    icon: <ViewModuleRoundedIcon />,
    order: 0,
  },
  [CategoryKey.TEXT]: {
    key: CategoryKey.TEXT,
    displayName: 'Text',
    icon: <TextFieldsRoundedIcon />,
    order: 1,
  },
  [CategoryKey.NUMBERS]: {
    key: CategoryKey.NUMBERS,
    displayName: 'Numbers',
    icon: <LooksOneRoundedIcon />,
    order: 2,
  },
  [CategoryKey.DATETIME]: {
    key: CategoryKey.DATETIME,
    displayName: 'Date & Time',
    icon: <CalendarMonthRoundedIcon />,
    order: 3,
  },
  [CategoryKey.MEDIA]: {
    key: CategoryKey.MEDIA,
    displayName: 'Media',
    icon: <InsertPhotoRoundedIcon />,
    order: 4,
  },
  [CategoryKey.LOCATION]: {
    key: CategoryKey.LOCATION,
    displayName: 'Location',
    icon: <PlaceRoundedIcon />,
    order: 5,
  },
  [CategoryKey.CHOICE]: {
    key: CategoryKey.CHOICE,
    displayName: 'Choice',
    icon: <ListAltRoundedIcon />,
    order: 6,
  },
  [CategoryKey.RELATIONSHIP]: {
    key: CategoryKey.RELATIONSHIP,
    displayName: 'Relationship',
    icon: <ShareRoundedIcon />,
    order: 7,
  },
  [CategoryKey.DISPLAY]: {
    key: CategoryKey.DISPLAY,
    displayName: 'Display',
    icon: <RemoveRedEyeRoundedIcon />,
    order: 8,
  },
};

/** array of every category key, in display order */
export const ALL_CATEGORIES = Object.values(CategoryConfigMap)
  .sort((a, b) => a.order - b.order)
  .map(cfg => cfg.key);
