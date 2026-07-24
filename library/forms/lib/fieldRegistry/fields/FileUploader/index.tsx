import {
  formatFileSize,
  attachmentSaveTrace,
  logError,
} from '@faims3/data-model';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
  useTheme,
} from '@mui/material';
import React, {useCallback, useMemo, useRef, useState} from 'react';
import Dropzone, {FileRejection} from 'react-dropzone';
import {z} from 'zod';
import {FullFormConfig} from '../../../formModule/formManagers/types';
import {BaseFieldParametersSchema} from '@faims3/data-model';
import {FormFieldContextProps} from '../../../formModule/types';
import {
  LoadedPhoto,
  useAttachments,
  useAttachmentsResult,
} from '../../../hooks/useAttachment';
import {FileUploaderRender} from '../../../rendering/fields/view/specialised/FileUploader';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

// ============================================================================
// Types & Schema
// ============================================================================

/**
 * Default maximum file size (bytes) applied when the notebook design does not
 * set `maximum_file_size`.
 */
export const DEFAULT_MAXIMUM_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MiB

/**
 * Hard ceiling for per-file uploads. Designer-configured `maximum_file_size`
 * values above this are clamped so a notebook cannot opt into unbounded files.
 */
export const HARD_MAXIMUM_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MiB

const fileUploaderPropsSchema = BaseFieldParametersSchema.extend({
  multiple: z.boolean().optional().default(true),
  maximum_number_of_files: z.number().optional().default(0),
  maximum_file_size: z.number().optional(), // in bytes
  minimum_file_size: z.number().optional(), // in bytes
});

type FileUploaderProps = z.infer<typeof fileUploaderPropsSchema>;
type FileUploaderFieldProps = FileUploaderProps & FormFieldContextProps;

interface FullFileUploaderFieldProps extends FileUploaderFieldProps {
  config: FullFormConfig;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Determines if a file is an image based on MIME type
 */
function isImageFile(contentType: string): boolean {
  return contentType.startsWith('image/');
}

/**
 * Gets appropriate icon for file type
 */
function getFileIcon(contentType: string) {
  if (isImageFile(contentType)) {
    return <ImageIcon />;
  }
  return <InsertDriveFileIcon />;
}

// ============================================================================
// Attachment Dialog Component
// ============================================================================

/**
 * Dialog for viewing file attachments in full screen
 * For images: shows the image
 * For other files: provides download instructions
 */
const AttachmentDialog: React.FC<{
  attachment: LoadedPhoto | null;
  open: boolean;
  onClose: () => void;
}> = ({attachment, open, onClose}) => {
  const theme = useTheme();

  if (!attachment) return null;

  const isImage = isImageFile(attachment.metadata.contentType);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={isImage ? 'lg' : 'sm'}
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          backgroundColor: isImage ? 'rgba(0, 0, 0, 0.9)' : undefined,
          borderRadius: theme.spacing(2),
        },
      }}
    >
      <DialogTitle sx={{m: 0, p: 2}}>
        {!isImage && attachment.metadata.filename}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            bgcolor: isImage ? 'rgba(0, 0, 0, 0.5)' : undefined,
            color: isImage ? 'white' : undefined,
            '&:hover': {
              bgcolor: isImage ? 'rgba(0, 0, 0, 0.7)' : undefined,
              transform: 'scale(1.1)',
            },
            transition: 'all 0.2s ease-in-out',
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{p: isImage ? 0 : 2}}>
        {isImage ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 400,
            }}
          >
            <Box
              component="img"
              src={attachment.url}
              alt={attachment.metadata.filename}
              sx={{
                maxWidth: '100%',
                maxHeight: '90vh',
                objectFit: 'contain',
              }}
            />
          </Box>
        ) : (
          <Box sx={{textAlign: 'center', py: 4}}>
            <AttachFileIcon
              sx={{fontSize: 64, color: 'text.secondary', mb: 2}}
            />
            <Typography variant="h6" gutterBottom>
              {attachment.metadata.filename}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              File preview not available
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{px: 3, pb: 2}}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// Preview Mode Component
// ============================================================================

/**
 * Preview mode component - shows a non-interactive placeholder display
 */
const FileUploaderPreview: React.FC<FileUploaderFieldProps> = props => {
  const {label, helperText, required, advancedHelperText, state} = props;
  const theme = useTheme();
  const fileCount = state.value?.attachments?.length || 0;

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={props.state.meta.errors as unknown as string[]}
    >
      <Paper
        sx={{
          padding: theme.spacing(4),
          textAlign: 'center',
          bgcolor: theme.palette.grey[100],
          borderRadius: theme.spacing(2),
          marginTop: theme.spacing(2),
        }}
      >
        <UploadFileIcon sx={{fontSize: 48, color: 'text.secondary', mb: 2}} />
        <Typography variant="h6" gutterBottom>
          File Upload Field (Preview Mode)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {fileCount === 0
            ? 'No files uploaded'
            : `${fileCount} file${fileCount === 1 ? '' : 's'} attached`}
        </Typography>
      </Paper>
    </FieldWrapper>
  );
};

// ============================================================================
// UI Components
// ============================================================================

/**
 * Dropzone area for file upload with drag-and-drop support
 */
const DropzoneArea: React.FC<{
  onDrop: (files: File[]) => void;
  onReject: (rejections: FileRejection[]) => void;
  onFileDialogOpen?: () => void;
  onFileDialogCancel?: () => void;
  disabled: boolean;
  multiple: boolean;
  maxFiles: number;
  maxSize?: number;
  minSize?: number;
}> = ({
  onDrop,
  onReject,
  onFileDialogOpen,
  onFileDialogCancel,
  disabled,
  multiple,
  maxFiles,
  maxSize,
  minSize,
}) => {
  const theme = useTheme();

  return (
    <Dropzone
      onDrop={onDrop}
      onDropRejected={onReject}
      onFileDialogOpen={onFileDialogOpen}
      onFileDialogCancel={onFileDialogCancel}
      disabled={disabled}
      multiple={multiple}
      maxFiles={maxFiles}
      maxSize={maxSize}
      minSize={minSize}
    >
      {({getRootProps, getInputProps, isDragActive}) => (
        <Paper
          {...getRootProps()}
          sx={{
            padding: theme.spacing(4),
            textAlign: 'center',
            backgroundColor: isDragActive
              ? theme.palette.action.hover
              : theme.palette.grey[100],
            border: `2px dashed ${
              isDragActive
                ? theme.palette.primary.main
                : theme.palette.grey[400]
            }`,
            borderRadius: theme.spacing(2),
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease-in-out',
            '&:hover': disabled
              ? {}
              : {
                  backgroundColor: theme.palette.action.hover,
                  borderColor: theme.palette.primary.main,
                },
          }}
        >
          <input {...getInputProps()} />
          <UploadFileIcon
            sx={{
              fontSize: 48,
              color: isDragActive
                ? theme.palette.primary.main
                : 'text.secondary',
              mb: 2,
            }}
          />
          <Typography variant="h6" gutterBottom>
            {isDragActive ? 'Drop files here' : 'Upload Files'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Drag and drop files here, or click to select
          </Typography>
        </Paper>
      )}
    </Dropzone>
  );
};

/**
 * Placeholder for files that couldn't be loaded
 */
const UnavailableFilePlaceholder: React.FC<{filename: string}> = ({
  filename,
}) => {
  const theme = useTheme();

  return (
    <ListItem>
      <ListItemIcon>
        <CloudOffIcon color="disabled" />
      </ListItemIcon>
      <ListItemText
        primary={filename}
        secondary="File not available - enable download in Settings"
        slotProps={{
          secondary: {
            sx: {color: theme.palette.warning.main},
          },
        }}
      />
    </ListItem>
  );
};

/**
 * Individual file item in the list
 */
const FileItem: React.FC<{
  data: LoadedPhoto;
  onDelete: () => void;
  onClick: () => void;
  disabled: boolean;
}> = ({data, onDelete, onClick, disabled}) => {
  const theme = useTheme();
  const isImage = isImageFile(data.metadata.contentType);

  return (
    <ListItem
      sx={{
        borderRadius: theme.spacing(1),
        mb: 1,
        bgcolor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        flexDirection: {xs: 'column', sm: 'row'},
        alignItems: {xs: 'stretch', sm: 'center'},
        gap: {xs: 1, sm: 0},
        p: {xs: 1.5, sm: 2},
        '&:hover': {
          bgcolor: theme.palette.action.hover,
        },
      }}
      secondaryAction={
        !disabled && (
          <IconButton
            edge="end"
            aria-label="delete"
            onClick={onDelete}
            color="error"
            sx={{
              position: {xs: 'absolute', sm: 'relative'},
              top: {xs: 8, sm: 'auto'},
              right: {xs: 8, sm: 'auto'},
            }}
          >
            <DeleteIcon />
          </IconButton>
        )
      }
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          width: '100%',
          pr: {xs: disabled ? 0 : 5, sm: disabled ? 0 : 6},
        }}
      >
        {isImage ? (
          <Box
            sx={{
              width: {xs: 60, sm: 80},
              height: {xs: 60, sm: 80},
              borderRadius: theme.spacing(1),
              overflow: 'hidden',
              flexShrink: 0,
              cursor: 'pointer',
            }}
            onClick={onClick}
          >
            <Box
              component="img"
              src={data.url}
              alt={data.metadata.filename}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: {xs: 48, sm: 56},
              height: {xs: 48, sm: 56},
              flexShrink: 0,
              cursor: 'pointer',
              borderRadius: theme.spacing(1),
              bgcolor: theme.palette.action.hover,
            }}
            onClick={onClick}
          >
            {getFileIcon(data.metadata.contentType)}
          </Box>
        )}
        <ListItemText
          primary={data.metadata.filename}
          secondary={data.metadata.contentType}
          sx={{
            cursor: 'pointer',
            minWidth: 0,
            flex: 1,
          }}
          slotProps={{
            primary: {
              sx: {
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                fontSize: {xs: '0.875rem', sm: '1rem'},
              },
            },
            secondary: {
              sx: {
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                fontSize: {xs: '0.75rem', sm: '0.875rem'},
              },
            },
          }}
          onClick={onClick}
        />
      </Box>
    </ListItem>
  );
};

/**
 * List of uploaded files
 */
const FileList: React.FC<{
  files: useAttachmentsResult;
  onDelete: (index: number) => void;
  onView: (index: number) => void;
  disabled: boolean;
}> = ({files, onDelete, onView, disabled}) => {
  if (files.length === 0) return null;

  return (
    <Box sx={{mt: 2}}>
      <Typography variant="subtitle2" gutterBottom>
        Uploaded Files ({files.length})
      </Typography>
      <List sx={{width: '100%'}}>
        {files.map((file, index) => {
          if (file.isLoading) {
            return (
              <ListItem key={index}>
                <ListItemIcon>
                  <AttachFileIcon />
                </ListItemIcon>
                <ListItemText primary="Loading..." secondary="Please wait" />
              </ListItem>
            );
          }

          if (file.isError || !file.data) {
            return (
              <UnavailableFilePlaceholder
                key={index}
                filename={`File ${index + 1}`}
              />
            );
          }

          return (
            <FileItem
              key={index}
              data={file.data}
              onDelete={() => onDelete(index)}
              onClick={() => onView(index)}
              disabled={disabled}
            />
          );
        })}
      </List>
    </Box>
  );
};

// ============================================================================
// Main Component (Full Mode)
// ============================================================================

/**
 * Main FileUploader component in full interactive mode
 */
const FileUploaderFull: React.FC<FullFileUploaderFieldProps> = props => {
  const {
    fieldId,
    label,
    helperText,
    required,
    advancedHelperText,
    disabled = false,
    multiple = true,
    maximum_number_of_files: maximumNumberOfFiles = 0,
    maximum_file_size: maximumFileSize = DEFAULT_MAXIMUM_FILE_SIZE_BYTES,
    minimum_file_size: minimumFileSize,
    state,
    addAttachment,
    removeAttachment,
    setAttachmentSaving,
    config: context,
  } = props;

  // Clamp designer-configured sizes so notebooks cannot raise the limit unboundedly
  const effectiveMaximumFileSize = Math.min(
    maximumFileSize,
    HARD_MAXIMUM_FILE_SIZE_BYTES
  );

  const [error, setError] = useState<string | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<number | null>(
    null
  );
  /** True while the native file picker is open (click-to-select path). */
  const filePickerLockHeldRef = useRef(false);

  // Get attachment service
  const attachmentService = context.attachmentEngine();

  // Load all attachments for this field
  const loadedFiles = useAttachments(
    (state.value?.attachments || []).map(att => att.attachmentId),
    attachmentService
  );

  /**
   * Handle file drop/selection
   */
  const handleFileDialogOpen = useCallback(() => {
    setAttachmentSaving?.(true);
    filePickerLockHeldRef.current = true;
  }, [setAttachmentSaving]);

  const handleFileDialogCancel = useCallback(() => {
    if (filePickerLockHeldRef.current) {
      setAttachmentSaving?.(false);
      filePickerLockHeldRef.current = false;
    }
  }, [setAttachmentSaving]);

  const handleDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setError(null);

      try {
        // Check file count limit
        const currentCount = state.value?.attachments?.length || 0;
        if (
          maximumNumberOfFiles > 0 &&
          currentCount + acceptedFiles.length > maximumNumberOfFiles
        ) {
          setError(
            `Maximum ${maximumNumberOfFiles} file${
              maximumNumberOfFiles === 1 ? '' : 's'
            } allowed`
          );
          return;
        }

        // Block section navigation until all files are stored in PouchDB.
        // Drag-and-drop sets the lock here; click-to-select sets it on dialog open.
        const lockFromPicker = filePickerLockHeldRef.current;
        if (!lockFromPicker) {
          setAttachmentSaving?.(true);
        }

        attachmentSaveTrace('FileUploader:save-start', {
          fieldId,
          fileCount: acceptedFiles.length,
        });
        try {
          // Upload each file
          const newAttachments: string[] = [];
          for (const file of acceptedFiles) {
            attachmentSaveTrace('FileUploader:upload-file', {
              fieldId,
              fileName: file.name,
              fileSize: file.size,
            });
            newAttachments.push(
              await addAttachment({
                blob: file,
                contentType: file.type || 'application/octet-stream',
                // Split on the file name
                fileFormat: file.name.split('.').pop() || 'txt',
                // File type - this helps inform naming scheme
                type: 'file',
              })
            );
          }

          props.setFieldData((prev: string[] | undefined) => [
            ...(prev ?? []),
            ...newAttachments,
          ]);

          attachmentSaveTrace('FileUploader:save-complete', {
            fieldId,
            attachmentIds: newAttachments,
          });
        } finally {
          setAttachmentSaving?.(false);
          filePickerLockHeldRef.current = false;
        }
      } catch (err: any) {
        logError(err);
        setError('Failed to upload file(s). Please try again.');
      }
    },
    [
      state.value,
      addAttachment,
      setAttachmentSaving,
      maximumNumberOfFiles,
      fieldId,
    ]
  );

  /**
   * Handle rejected files (validation failures)
   */
  const handleReject = useCallback(
    (rejections: FileRejection[]) => {
      const rejection = rejections[0];
      if (!rejection) return;

      const errorCode = rejection.errors[0]?.code;
      let errorMessage = 'File upload failed';

      switch (errorCode) {
        case 'file-too-large':
          errorMessage = effectiveMaximumFileSize
            ? `File is too large. Maximum size: ${formatFileSize(
                effectiveMaximumFileSize
              )}`
            : 'File is too large';
          break;
        case 'file-too-small':
          errorMessage = minimumFileSize
            ? `File is too small. Minimum size: ${formatFileSize(
                minimumFileSize
              )}`
            : 'File is too small';
          break;
        case 'too-many-files':
          errorMessage = 'Too many files selected';
          break;
        default:
          errorMessage = rejection.errors[0]?.message || 'File upload failed';
      }

      setError(errorMessage);
    },
    [effectiveMaximumFileSize, minimumFileSize]
  );

  /**
   * Handle file deletion
   */
  const handleDelete = useCallback(
    (index: number) => {
      const currentAttachments = state.value?.attachments || [];
      const targetId = currentAttachments[index].attachmentId;
      removeAttachment({attachmentId: targetId});
      const currentData = props.state.value?.data as string[] | undefined;
      props.setFieldData((currentData ?? []).filter(v => v !== targetId));
      setError(null);
    },
    [state.value, removeAttachment]
  );

  /**
   * Handle file view
   */
  const handleView = useCallback((index: number) => {
    setViewingAttachment(index);
  }, []);

  // Calculate max files for dropzone
  const maxFiles = useMemo(() => {
    if (!multiple) return 1;
    if (maximumNumberOfFiles === 0) return 0;
    const currentCount = state.value?.attachments?.length || 0;
    return Math.max(0, maximumNumberOfFiles - currentCount);
  }, [multiple, maximumNumberOfFiles, state.value?.attachments]);

  // Get currently viewing attachment data
  const viewingData =
    viewingAttachment !== null ? loadedFiles[viewingAttachment]?.data : null;

  let relevantErrors = props.state.meta.errors as unknown as string[];
  if (error) {
    relevantErrors = [...relevantErrors, error];
  }

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={relevantErrors}
    >
      <Box sx={{width: '100%'}}>
        {/* Attachment Download Warning */}
        {loadedFiles.some(f => f.isError) && (
          <Alert severity="warning" sx={{mb: 2}}>
            Some files could not be loaded. To download attachments, enable
            attachment download in Settings.
          </Alert>
        )}

        {/* Upload Area */}
        {!disabled && maxFiles >= 0 && (
          <DropzoneArea
            onDrop={handleDrop}
            onReject={handleReject}
            onFileDialogOpen={handleFileDialogOpen}
            onFileDialogCancel={handleFileDialogCancel}
            disabled={disabled}
            multiple={multiple}
            maxFiles={maxFiles}
            maxSize={effectiveMaximumFileSize}
            minSize={minimumFileSize}
          />
        )}

        {/* File Limit Info */}
        {maximumNumberOfFiles > 0 && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{display: 'block', mt: 1}}
          >
            {state.value?.attachments?.length || 0} / {maximumNumberOfFiles}{' '}
            file{maximumNumberOfFiles === 1 ? '' : 's'}
          </Typography>
        )}

        {/* File List */}
        <FileList
          files={loadedFiles}
          onDelete={handleDelete}
          onView={handleView}
          disabled={disabled}
        />

        {/* Viewing Dialog */}
        <AttachmentDialog
          attachment={viewingData || null}
          open={viewingAttachment !== null}
          onClose={() => setViewingAttachment(null)}
        />
      </Box>
    </FieldWrapper>
  );
};

// ============================================================================
// Main Export Component
// ============================================================================

/**
 * FileUploader field component - routes to preview or full mode
 */
export const FileUploader: React.FC<FileUploaderFieldProps> = props => {
  const {config: context} = props;

  if (context.mode === 'preview') {
    return <FileUploaderPreview {...props} />;
  } else if (context.mode === 'full') {
    const fullConfig = props.config as FullFormConfig;
    return <FileUploaderFull {...{...props, config: fullConfig}} />;
  }

  return null;
};

// ============================================================================
// Field Registration
// ============================================================================

/**
 * Field specification for registering the FileUploader component
 */
export const fileUploaderFieldSpec: FieldInfo<FileUploaderFieldProps> = {
  namespace: 'faims-custom',
  name: 'FileUploader',
  returns: 'faims-attachment::Files',
  component: FileUploader,
  fieldPropsSchema: fileUploaderPropsSchema,
  fieldDataSchemaFunction: (props: FileUploaderProps) => {
    // check there is at least one entry
    let base: z.ZodType<any> = z.array(z.string());
    if (props.required) {
      base = base.refine(val => (val ?? []).length > 0, {
        message: 'At least one attachment is required',
      });
    }

    if (props.maximum_number_of_files > 0) {
      base = base.refine(val => val.length <= props.maximum_number_of_files, {
        message: `Maximum ${props.maximum_number_of_files} file${
          props.maximum_number_of_files === 1 ? '' : 's'
        } allowed`,
      });
    }

    return base;
  },
  view: {
    component: FileUploaderRender,
    config: {},
    attributes: {singleColumn: false},
  },
};
