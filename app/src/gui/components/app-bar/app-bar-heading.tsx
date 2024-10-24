import {NavLink} from 'react-router-dom';
import {appBarHeading} from '../../themes/index';
import {NOTEBOOK_NAME_CAPITALIZED} from '../../../buildconfig';

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
  <>
    <NavLink style={{flexGrow: 0}} to={link}>
      <img
        src="/assets/icons/icon-48.webp"
        style={{maxWidth: '140px', flex: 1}}
      />
    </NavLink>
    <NavLink to={link}
      style={{
        flexGrow: 1,
        fontSize: 32,
        fontWeight: 600,
        textAlign: 'left',
        textDecoration: 'none',
        color: 'inherit'
      }}
    >
      {NOTEBOOK_NAME_CAPITALIZED}s
    </NavLink>
  </>
);
