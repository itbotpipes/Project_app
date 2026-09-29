import Avatar from "../_components/Avatar";

export type OrgPerson = {
  id: string;
  name: string;
  roleTitle: string;
  avatarUrl?: string | null;
  departmentName?: string | null;
  level?: number;
  children: OrgPerson[];
};

export default function OrgNode({ node, depth = 0 }: { node: OrgPerson; depth?: number }) {
  return (
    <div className="relative">
      <div className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-xs">
        <Avatar name={node.name} url={node.avatarUrl} size={36} className="ring-1 ring-slate-200 shrink-0" />
        <div className="min-w-0 text-left">
          <div className="truncate text-sm font-bold text-slate-900">{node.name}</div>
          <div className="truncate text-xs text-blue-600 font-medium">{node.roleTitle}</div>
        </div>
      </div>
      {node.children.length > 0 && (
        <div className="mt-3 ml-6 space-y-3 border-l-2 border-dashed border-slate-200 pl-6">
          {node.children.map((child) => (
            <OrgNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
