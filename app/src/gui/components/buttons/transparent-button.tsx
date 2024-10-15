interface TransparentButtonProps {
  onClick: () => void;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * A button component with transparent styling.
 *
 * @param {Object} props - The props for the component.
 * @param {function} props.onClick - Function to handle the click event.
 * @param {React.ReactNode} props.children - The content to be displayed inside the button.
 * @returns {JSX.Element} A div element styled as a transparent button.
 */
export default function TransparentButton({
  onClick,
  style,
  children,
}: TransparentButtonProps) {
  return (
    <div
      onClick={onClick}
      style={{
        ...style,
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        cursor: 'pointer',
      }}
    >
      {children}
    </div>
  );
}
