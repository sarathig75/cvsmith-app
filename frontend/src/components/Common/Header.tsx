import cx from 'classnames';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { logOut } from '../../utils/logOut';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/canvas', label: 'Canvas' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/settings', label: 'Settings' },
];

export function Header({ showNav }: { showNav: boolean }) {
  const navigate = useNavigate();
  // "Align to job" is a tab only while the user is on that screen (opened from the dashboard).
  const onAlign = useLocation().pathname.startsWith('/align');
  const shown = onAlign ? [links[0], { to: '/align', label: 'Align to job' }, ...links.slice(1)] : links;
  return (
    <header className="fixed inset-x-0 top-0 z-[100] flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:h-16 md:px-6 lg:px-8">
      <div className="text-xl font-bold text-brand">CVSmith</div>
      {showNav && (
        <nav aria-label="Main" className="flex h-full gap-1 md:gap-4">
          {shown.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cx(
                  'flex h-full items-center border-b-[3px] px-2 text-sm font-medium md:px-4',
                  isActive ? 'border-brand text-brand' : 'border-transparent text-slate-600 hover:text-slate-900',
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={async () => {
              await logOut();
              navigate('/', { replace: true });
            }}
            className="flex h-full items-center border-b-[3px] border-transparent px-2 text-sm font-medium text-slate-600 hover:text-slate-900 md:px-4"
          >
            Log out
          </button>
        </nav>
      )}
    </header>
  );
}
