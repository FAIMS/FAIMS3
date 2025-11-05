import {DatabaseInterface, DataDocument, DataEngine} from '@faims3/data-model';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import {Box, Paper, Typography} from '@mui/material';
import {useQueries, useQuery} from '@tanstack/react-query';
import {useMemo} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import {localGetDataDb} from '../../../../..';
import {
  createProjectAttachmentService,
  NOTEBOOK_NAME_CAPITALIZED,
} from '../../../../../buildconfig';
import * as ROUTES from '../../../../../constants/routes';
import {selectActiveServerId} from '../../../../../context/slices/authSlice';
import {useAppSelector} from '../../../../../context/store';
import {DataViewFieldRender} from '../../../types';
import {TextWrapper} from '../wrappers';

// Image types we are interested in displaying
const imageTypes = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
];

export const TakePhotoRender: DataViewFieldRender = props => {
  // What server is this?
  const serverId = useAppSelector(selectActiveServerId);
  // Photo details are not properly hydrated out of the box, we need to grab the
  // AVP record directly (which we can find easily)
  const dataDb = localGetDataDb(props.renderContext.recordMetadata.project_id);
  const dataEngine = useMemo(() => {
    return new DataEngine({
      dataDb: dataDb as DatabaseInterface<DataDocument>,
      uiSpec: props.renderContext.uiSpecification,
    });
  }, [dataDb, props.renderContext.uiSpecification]);

  // Generate attachment service for this project
  const attachmentService = useMemo(() => {
    return createProjectAttachmentService(
      props.renderContext.recordMetadata.project_id
    );
  }, [props.renderContext.recordMetadata.project_id]);

  // What is the AVP?
  const avpId =
    props.renderContext.recordMetadata.avps[props.renderContext.fieldId];
  // Now get the actual record
  const avpRecordQuery = useQuery({
    queryFn: async () => {
      try {
        return await dataEngine.core.getAvp(avpId);
      } catch (e) {
        console.error('Failed to fetch avp', e);
      }
    },
    queryKey: ['avp-attachment-fetch', avpId],
  });
  const avpData = avpRecordQuery.data;
  // For each faims attachment, get the attachment name
  const attachmentDocumentIdList = avpData?.faims_attachments?.map(
    attInfo => attInfo.attachment_id
  );
  // Fetch all attachments using base 64 attachment service
  const attRecordsQuery = useQueries({
    queries: (attachmentDocumentIdList || []).map(attId => {
      return {
        queryFn: async () => {
          return await attachmentService.loadAttachmentAsBase64({
            identifier: {id: attId},
          });
        },
        queryKey: ['attachment-fetch', attId],
      };
    }),
  });
  const allAttachmentDocs = attRecordsQuery.map(d => {
    // Not entirely unexpected given we may not have synced attachments
    if (d.isError) {
      return undefined;
    }
    return d.data;
  });

  // Separate downloaded and not-downloaded attachments
  const notDownloadedCount = allAttachmentDocs.filter(d => !d).length;
  const allAttachments = allAttachmentDocs.filter(d => !!d).map(d => d);

  // Map the attachment documents into presentable images
  const toDisplay = allAttachments.map(att => ({
    contentType: att.metadata.contentType,
    data: att.base64,
  }));
  const displayableImages = toDisplay.filter(item =>
    imageTypes.includes(item.contentType.toLowerCase())
  );

  return (
    <div>
      {displayableImages.length === 0 && notDownloadedCount === 0 ? (
        <TextWrapper content={'No images to display'}></TextWrapper>
      ) : (
        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 2}}>
          {displayableImages.map((img, idx) => (
            <img
              key={idx}
              src={`data:${img.contentType};base64,${img.data}`}
              alt={`Attachment ${idx + 1}`}
              style={{
                maxWidth: '300px',
                maxHeight: '300px',
                objectFit: 'contain',
              }}
            />
          ))}
          {Array.from({length: notDownloadedCount}).map((_, idx) => (
            <Paper
              key={`placeholder-${idx}`}
              sx={{
                width: '300px',
                height: '300px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(0, 0, 0, 0.05)',
                border: '2px dashed rgba(0, 0, 0, 0.2)',
                gap: 1,
                p: 2,
              }}
            >
              <CloudOffIcon
                sx={{
                  fontSize: 48,
                  color: 'rgba(0, 0, 0, 0.3)',
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(0, 0, 0, 0.6)',
                  textAlign: 'center',
                }}
              >
                Attachment not synced
              </Typography>
              {serverId && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(0, 0, 0, 0.5)',
                    textAlign: 'center',
                    maxWidth: '250px',
                  }}
                >
                  To download attachments, go to{' '}
                  <RouterLink
                    to={`${ROUTES.getNotebookRoute({serverId, projectId: props.renderContext.recordMetadata.project_id})}?${ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE_TAB_Q}=settings`}
                    style={{
                      color: 'inherit',
                      textDecoration: 'underline',
                    }}
                  >
                    {NOTEBOOK_NAME_CAPITALIZED} Settings
                  </RouterLink>{' '}
                  and enable attachment download
                </Typography>
              )}
            </Paper>
          ))}
        </Box>
      )}
    </div>
  );
};
