interface CenterControlIconProps {
  src: string;
  width: number;
  height: number;
  alt: string;
}

/**
 * Creates a DOM image element with the specified properties.
 *
 * @param {CenterControlIconProps} props - The properties for the image element.
 * @param {string} props.src - The source URL of the image.
 * @param {number} props.width - The width of the image in pixels.
 * @param {number} props.height - The height of the image in pixels.
 * @param {string} props.alt - The alternative text for the image.
 * @returns {HTMLImageElement} - The created image element.
 */
export const CreateDomIcon = ({
  src,
  width,
  height,
  alt,
}: CenterControlIconProps) => {
  const img = document.createElement('img');

  img.width = width;
  img.height = height;
  img.src = src;
  img.alt = alt;

  return img;
};
