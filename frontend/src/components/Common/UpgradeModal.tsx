import { Link } from 'react-router-dom';
import { Button } from './Button';
import { Modal } from './Modal';

/** "Upgrade to Pro" with the server's message, a link to the plans and "Not now". */
export function UpgradeModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <Modal title="Upgrade to Pro" onClose={onClose}>
      <p className="mb-6 text-slate-700">{message}</p>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/pricing"
          className="inline-flex min-h-[44px] items-center rounded-sm bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark"
        >
          See Pro plans
        </Link>
        <Button variant="secondary" onClick={onClose}>
          Not now
        </Button>
      </div>
    </Modal>
  );
}
