const STATUS_STYLES = {
  DRAFT: 'bg-dark-600/50 text-dark-200 border border-dark-500/50',
  PENDING: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  APPROVED: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  REJECTED: 'bg-red-500/15 text-red-300 border border-red-500/30',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] || 'bg-dark-600/50 text-dark-200'}`}>
      {status === 'PENDING' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse" />}
      {status === 'APPROVED' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />}
      {status === 'REJECTED' && <span className="w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5" />}
      {status}
    </span>
  );
}
