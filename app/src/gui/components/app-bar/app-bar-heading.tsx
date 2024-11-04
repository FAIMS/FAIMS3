import {NavLink} from 'react-router-dom';
import {APP_NAME} from '../../../buildconfig';

interface AppBarHeadingProps {
  link: string;
}

/**
 * AppBarHeading component that conditionally renders a heading or a logo based on the appBarHeading value.
 *
 * @param {AppBarHeadingProps} props - The properties for the AppBarHeading component.
 * @param {string} props.link - The link URL for the NavLink component.
 * @returns {JSX.Element} - The rendered AppBarHeading component.
 */
export const AppBarHeading = ({link}: AppBarHeadingProps) => (
  <NavLink
    to={link}
    style={{
      display: 'flex',
      alignItems: 'center',
      flex: 1,
      textDecoration: 'none',
      color: 'black',
    }}
  >
    <img src="/assets/icons/icon-48.webp" />
    <h1>{APP_NAME}</h1>
  </NavLink>
);
