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
export const AppBarHeading = ({link}: AppBarHeadingProps) =>
  appBarHeading === 'bubble' ? (
    <div
      style={{
        flexGrow: 1,
        fontSize: 32,
        fontWeight: 600,
        textAlign: 'center',
      }}
    >
      {NOTEBOOK_NAME_CAPITALIZED}s
    </div>
  ) : (
    <NavLink style={{flexGrow: 1}} to={link}>
      <img
        src="/static/logo/Fieldmark-Short-Green-NoBorder.png"
        style={{maxWidth: '140px', flex: 1}}
      />
    </NavLink>
  );
