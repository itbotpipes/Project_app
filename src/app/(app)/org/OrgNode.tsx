export type OrgPerson = {
  id: string;
  name: string;
  roleTitle: string;
  children: OrgPerson[];
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function OrgNode({ node, depth = 0 }: { node: OrgPerson; depth?: number }) {
  return (
    <div className="relative">
      <div className="group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
          {initials(node.name)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-900">{node.name}</div>
          <div className="truncate text-xs text-slate-500">{node.roleTitle}</div>
        </div>
      </div>
      {node.children.length > 0 && (
        <div className="mt-3 ml-5 space-y-3 border-l-2 border-dashed border-slate-200 pl-5">
          {node.children.map((child) => (
            <OrgNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
