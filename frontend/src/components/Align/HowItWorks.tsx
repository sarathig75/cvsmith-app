/** The same three lines on both Align to job screens (approved mock). */
export function HowItWorks({ title }: { title?: string }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-blue-200 bg-blue-50 p-5 text-sm leading-relaxed text-blue-900">
      {title && <span className="font-semibold text-brand-dark">{title}</span>}
      <span>
        <strong>Base CV in Canvas:</strong> your permanent baseline.
      </span>
      <span>
        <strong>Align to job:</strong> a customised CV for a specific role. Download the version as a PDF to apply for that role.
      </span>
      <span>
        <strong>Note:</strong> update your base CV only when you want the changes everywhere.
      </span>
    </div>
  );
}
