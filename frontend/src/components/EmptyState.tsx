import type { ReactNode } from "react";

export default function EmptyState({
  icon = "📭",
  title,
  children,
}: {
  icon?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 p-10 text-center">
      <div className="text-4xl">{icon}</div>
      <h3 className="font-semibold text-slate-700">{title}</h3>
      {children && <div className="text-sm text-slate-500">{children}</div>}
    </div>
  );
}
