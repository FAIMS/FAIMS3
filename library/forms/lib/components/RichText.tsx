import {contentToSanitizedHtml} from '../fieldRegistry/fields/RichText/DomPurifier';

export const RichTextContent: React.FC<{content: string}> = ({content}) => {
  if (!content?.trim()) {
    // Return nothing if content is empty or whitespace
    return null;
  }

  return (
    <div dangerouslySetInnerHTML={{__html: contentToSanitizedHtml(content)}} />
  );
};
