import {IAttachmentService, LoadAttachmentResult} from '@faims3/data-model';
import {useQueries, useQuery} from '@tanstack/react-query';

/**
 * Query key factory for attachment queries
 */
export const useAttachmentsQueryKey = {
  all: ['attachments'] as const,
  attachment: (id: string) => [...useAttachmentsQueryKey.all, id] as const,
};

// The load attachment result + object URL
export type LoadedPhoto = LoadAttachmentResult & {url: string; id: string};

/**
 * Custom hook to fetch attachment using TanStack Query
 */
export const useAttachment = (
  attachmentId: string,
  attachmentService: IAttachmentService
) => {
  return useQuery({
    queryKey: useAttachmentsQueryKey.attachment(attachmentId),
    queryFn: async () => {
      const result = await attachmentService.loadAttachmentAsBlob({
        identifier: {id: attachmentId},
      });
      // Create object URL for display
      const url = URL.createObjectURL(result.blob);
      return {...result, url, id: attachmentId} satisfies LoadedPhoto;
    },
    // Keep data in cache for 10 minutes
    staleTime: 10 * 60 * 1000,
    // Cache for 30 minutes
    gcTime: 30 * 60 * 1000,
    // Continue retrying even when offline
    networkMode: 'always',
  });
};

/**
 * Custom hook to fetch a set of attachments using TanStack Query
 */
export const useAttachments = (
  attachmentIds: string[],
  attachmentService: IAttachmentService
) => {
  return useQueries({
    queries: attachmentIds.map(attachmentId => ({
      queryKey: useAttachmentsQueryKey.attachment(attachmentId),
      queryFn: async () => {
        const result = await attachmentService.loadAttachmentAsBlob({
          identifier: {id: attachmentId},
        });
        // Create object URL for display
        const url = URL.createObjectURL(result.blob);
        return {...result, url, id: attachmentId} satisfies LoadedPhoto;
      },
      // Keep data in cache for 10 minutes
      staleTime: 10 * 60 * 1000,
      // Cache for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Continue retrying even when offline
      networkMode: 'always',
    })),
  });
};

export type useAttachmentsResult = ReturnType<typeof useAttachments>;
