import {FAIMSAttachment, getAtt, getAvp} from '@faims3/data-model';
import {useQueries, useQuery} from '@tanstack/react-query';
import {localGetDataDb} from '../../../..';
import {RenderFunctionComponent} from '../../types';
import {Box, Typography, Paper} from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import * as ROUTES from '../../../../constants/routes';
import {Link as RouterLink} from 'react-router-dom';
import {NOTEBOOK_NAME_CAPITALIZED} from '../../../../buildconfig';
import {selectActiveServerId} from '../../../../context/slices/authSlice';
import {useAppSelector} from '../../../../context/store';
import {TextWrapper} from '../wrappers';

// Image types we are interested in displaying
const imageTypes = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
];

export const TakePhotoRender: RenderFunctionComponent = props => {
  // What server is this?
  const serverId = useAppSelector(selectActiveServerId);
  // Photo details are not properly hydrated out of the box, we need to grab the
  // AVP record directly (which we can find easily)
  const dataDb = localGetDataDb(
    props.rendererContext.recordMetadata.project_id
  );
  // What is the AVP?
  const avpId =
    props.rendererContext.recordMetadata.avps[props.rendererContext.fieldId];
  // Now get the actual record
  const avpRecordQuery = useQuery({
    queryFn: async () => {
      return await getAvp({
        avpId,
        dataDb,
      });
    },
    queryKey: ['avp-attachment-fetch', avpId],
  });
  const avpData = avpRecordQuery.data;
  // For each faims attachment, get the attachment name/ref and fetch the att- records
  const attachmentDocumentIdList = avpData?.faims_attachments?.map(
    attInfo => attInfo.attachment_id
  );
  const attRecordsQuery = useQueries({
    queries: (attachmentDocumentIdList || []).map(attId => {
      return {
        queryFn: async () => {
          try {
            // Include attachments here - it's only local still and we are about to display them!
            const res = await getAtt({dataDb, attId, includeAttachments: true});
            return res;
          } catch (e) {
            // Return a special object to indicate this attachment is not downloaded
            return undefined;
          }
        },
        queryKey: ['attachment-fetch', attId],
      };
    }),
  });
  const allAttachmentDocs: Array<FAIMSAttachment | undefined> =
    attRecordsQuery.map(d => {
      return d.data;
    });

  // Separate downloaded and not-downloaded attachments
  const notDownloadedCount = allAttachmentDocs.filter(d => !d).length;
  const presentAttDocs: FAIMSAttachment[] = allAttachmentDocs.filter(d => !!d);

  let allAttachments: (PouchDB.Core.Attachment & {
    // Base 64 encoded (include_attachments = true, binary = false)
    data: string;
  })[] = [];
  for (const doc of presentAttDocs) {
    if (doc._attachments) {
      allAttachments = allAttachments.concat(
        Array.from(Object.values(doc._attachments as any))
      );
    }
  }
  // Map the attachment documents into presentable images
  const toDisplay: {
    contentType: string;
    data: string;
  }[] = allAttachments.map(att => ({
    contentType: att.content_type,
    data: att.data,
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
                    to={`${ROUTES.getNotebookRoute({serverId, projectId: props.rendererContext.recordMetadata.project_id})}?${ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE_TAB_Q}=settings`}
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
