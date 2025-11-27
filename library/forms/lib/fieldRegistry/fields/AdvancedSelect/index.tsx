/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * AdvancedSelect Component
 *
 * A hierarchical tree-based select field for navigating nested vocabulary structures.
 * Displays options in an expandable tree view with support for:
 * - Nested hierarchical options
 * - Image type nodes with attachment previews
 * - Full path or child-only value modes
 *
 * Props:
 * - label (string, optional): The field label displayed as a heading.
 * - helperText (string, optional): The field help text displayed below the heading.
 * - ElementProps (object): Contains the optiontree hierarchy.
 * - valuetype (string, optional): 'child' for leaf value only, 'full' for full path.
 * - required: To visually show if the field is required.
 * - disabled: Whether the field is disabled.
 */

import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TreeItem, {TreeItemProps, useTreeItem} from '@mui/lab/TreeItem';
import TreeView from '@mui/lab/TreeView';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import clsx from 'clsx';
import React from 'react';
import {z} from 'zod';
import {BaseFieldPropsSchema, FullFieldProps} from '../../../formModule/types';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

// ============================================================================
// Types & Schema
// ============================================================================

const RenderTreeSchema: z.ZodType<RenderTree> = z.lazy(() =>
  z.object({
    name: z.string(),
    children: z.array(RenderTreeSchema).optional(),
    type: z.string().optional(),
    label: z.string().optional(),
  })
);

interface RenderTree {
  name: string;
  children?: RenderTree[];
  type?: string;
  label?: string;
}

const AdvancedSelectFieldPropsSchema = BaseFieldPropsSchema.extend({
  ElementProps: z.object({
    optiontree: z.array(RenderTreeSchema),
  }),
  valuetype: z.string().optional(),
});

type AdvancedSelectFieldProps = z.infer<typeof AdvancedSelectFieldPropsSchema>;
type FieldProps = AdvancedSelectFieldProps & FullFieldProps;

// ============================================================================
// Custom Tree Item Components
// ============================================================================

/**
 * Extended content props that include our custom selection handler and metadata.
 * These are passed through ContentProps and merged with TreeItemContentProps at runtime.
 */
interface CustomContentAdditionalProps {
  onSelectValue: (
    nodeId: string,
    type: string | undefined,
    name: string,
    label: string | undefined
  ) => void;
  type?: string;
  name: string;
}

/**
 * Custom content component for tree items.
 * Handles click events to both expand/collapse and trigger selection.
 */
const CustomContent = React.forwardRef<HTMLDivElement, any>((props, ref) => {
  const {
    className,
    classes,
    label,
    nodeId,
    icon: iconProp,
    expansionIcon,
    displayIcon,
    onSelectValue,
    type,
    name,
  } = props;

  const {
    disabled,
    expanded,
    selected,
    focused,
    handleExpansion,
    handleSelection,
    preventSelection,
  } = useTreeItem(nodeId);

  const icon = iconProp || expansionIcon || displayIcon;

  const handleMouseDown = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    preventSelection(event);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    handleExpansion(event);
    handleSelection(event);
    if (onSelectValue) {
      onSelectValue(nodeId, type, name, label as string | undefined);
    }
  };

  return (
    <div
      className={clsx(className, classes.root, {
        'Mui-expanded': expanded,
        'Mui-selected': selected,
        'Mui-focused': focused,
        'Mui-disabled': disabled,
      })}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      ref={ref}
    >
      <div className="MuiTreeItem-contentBar" />
      <div className={classes.iconContainer}>{icon}</div>
      <div className={classes.label}>
        <Typography>{(label as string) ?? name}</Typography>
      </div>
    </div>
  );
});

CustomContent.displayName = 'CustomContent';

interface CustomTreeItemProps extends TreeItemProps {
  onSelectValue: (
    nodeId: string,
    type: string | undefined,
    name: string,
    label: string | undefined
  ) => void;
  type?: string;
  name: string;
}

const CustomTreeItem = (props: CustomTreeItemProps) => {
  const {onSelectValue, type, name, label} = props;

  // Pass custom props through ContentProps - they get merged with
  // TreeItemContentProps at runtime
  const contentProps: CustomContentAdditionalProps = {
    onSelectValue: (nodeId: string) =>
      onSelectValue(nodeId, type, name, label as string | undefined),
    type,
    name,
  };

  return (
    <TreeItem
      key={props.nodeId}
      {...props}
      // TODO validate this - typing is not working
      ContentComponent={CustomContent as any}
      ContentProps={contentProps as any}
    />
  );
};

// ============================================================================
// Value Display Components
// ============================================================================

interface ValueChipProps {
  value: string;
}

const ValueChip = ({value}: ValueChipProps) => {
  return (
    <Box component="li" sx={{margin: 0.5, listStyle: 'none'}}>
      <Chip label={value} />
    </Box>
  );
};

interface ValueChipsDisplayProps {
  values: string[];
}

const ValueChipsDisplay = ({values}: ValueChipsDisplayProps) => {
  const nonEmptyValues = values.filter(v => v !== '');

  if (nonEmptyValues.length === 0) {
    return null;
  }

  return (
    <Paper
      sx={{
        display: 'flex',
        justifyContent: 'flex-start',
        flexWrap: 'wrap',
        listStyle: 'none',
        p: 0.5,
        m: 0,
        mb: 1,
      }}
      component="ul"
    >
      {nonEmptyValues.map(value => (
        <ValueChip key={value} value={value} />
      ))}
    </Paper>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * AdvancedSelect Component - A hierarchical tree-based select field
 * for navigating nested vocabulary structures.
 */
export const AdvancedSelect = (props: FieldProps) => {
  const {
    label,
    helperText,
    required,
    advancedHelperText,
    disabled,
    state,
    setFieldData,
    ElementProps,
  } = props;

  const valuetype = props.valuetype ?? 'full';

  // Get current value, ensuring it's always an array for display
  const rawValue = state.value?.data as string | undefined;
  const displayValues: string[] =
    rawValue !== null && rawValue !== undefined && rawValue !== ''
      ? [rawValue]
      : [];

  /**
   * Handles selection of a tree node.
   * Depending on valuetype, stores either the full path or just the child name.
   */
  const onSelectValue = (
    newValue: string,
    type: string | undefined,
    name: string,
    nodeLabel: string | undefined
  ) => {
    if (valuetype === 'child') {
      // For child mode, store just the name (with label for images)
      let childValue = name;
      if (type === 'image' && nodeLabel) {
        childValue = `${nodeLabel}(${name})`;
      }
      setFieldData(childValue);
    } else {
      // For full mode, store the full path (nodeId contains the full path)
      setFieldData(newValue);
    }
  };

  /**
   * Recursively renders tree nodes from the optiontree structure.
   */
  const renderTree = (
    node: RenderTree,
    key: number,
    parentKey: string,
    parentNodePath: string
  ): React.ReactNode => {
    const singleKey = parentKey !== '' ? `${parentKey}.${key}` : `${key}`;

    // Build the full path for this node
    let nodePath: string;
    if (node.type === 'image' && node.label !== undefined) {
      nodePath =
        parentNodePath !== ''
          ? `${parentNodePath} > ${node.label}(${node.name})`
          : `${node.label}(${node.name})`;
    } else {
      nodePath =
        parentNodePath !== '' ? `${parentNodePath} > ${node.name}` : node.name;
    }

    return (
      <CustomTreeItem
        key={singleKey}
        nodeId={nodePath}
        name={node.name}
        type={node.type}
        onSelectValue={onSelectValue}
        label={node.label ?? node.name}
      >
        {Array.isArray(node.children)
          ? node.children.map((childNode, childKey) =>
              renderTree(childNode, childKey, singleKey, nodePath)
            )
          : null}
      </CustomTreeItem>
    );
  };

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
    >
      <Box sx={{mt: 1}}>
        {/* Display currently selected value(s) */}
        <ValueChipsDisplay values={displayValues} />

        {/* Tree view for selection (hidden when disabled) */}
        {!disabled && (
          <Box sx={{overflowY: 'auto'}}>
            <TreeView
              aria-label="hierarchical select"
              defaultCollapseIcon={<ExpandMoreIcon />}
              defaultExpandIcon={<ChevronRightIcon />}
              sx={{
                flexGrow: 1,
                minWidth: 500,
                maxHeight: 300,
                overflowY: 'auto',
              }}
            >
              {Array.isArray(ElementProps.optiontree) &&
                ElementProps.optiontree.map((node, key) =>
                  renderTree(node, key, '', '')
                )}
            </TreeView>
          </Box>
        )}
      </Box>
    </FieldWrapper>
  );
};

// ============================================================================
// Value Schema
// ============================================================================

/**
 * Generate a zod schema for the value.
 * The value is a string representing the selected path or child name.
 */
const valueSchema = () => {
  return z.string();
};

// ============================================================================
// Field Registration
// ============================================================================

/**
 * Export a constant with the information required to register this field type
 */
export const advancedSelectFieldSpec: FieldInfo<FieldProps> = {
  namespace: 'faims-custom',
  name: 'AdvancedSelect',
  returns: 'faims-core::String',
  component: AdvancedSelect,
  fieldSchema: AdvancedSelectFieldPropsSchema,
  valueSchemaFunction: valueSchema,
};
