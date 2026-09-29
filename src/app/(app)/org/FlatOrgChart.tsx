import Avatar from "../_components/Avatar";

export type FlatPerson = {
  id: string;
  name: string;
  roleTitle: string;
  avatarUrl?: string | null;
  level?: number;
};

export type FlatDept = {
  id: string;
  name: string;
  people: FlatPerson[];
};

export type FlatOrgData = {
  root: FlatPerson | null;
  departments: FlatDept[];
};

export default function FlatOrgChart({ data }: { data: FlatOrgData }) {
  if (!data.root) {
    return <p className="py-8 text-center text-sm text-slate-400">No org data yet.</p>;
  }
  return (
    <div className="overflow-x-auto py-2">
      <ul className="org-tree min-w-max">
        <li>
          <div className="inline-flex items-center gap-3 rounded-2xl border-2 border-blue-400 bg-white px-5 py-3 shadow-md">
            <Avatar name={data.root.name} url={data.root.avatarUrl} size={42} />
            <div className="text-left">
              <div className="text-sm font-bold uppercase tracking-wide text-slate-900">{data.root.name}</div>
              <div className="text-xs font-semibold text-blue-600">{data.root.roleTitle}</div>
            </div>
          </div>
          {data.departments.length > 0 && (
            <ul>
              {data.departments.map((d) => (
                <li key={d.id}>
                  <div className="rounded-xl border-2 border-blue-300 bg-white px-5 py-2.5 text-sm font-bold capitalize text-blue-700 shadow-xs">
                    {d.name}
                  </div>
                  {d.people.length > 0 && (
                    <ul>
                      {d.people.map((p) => (
                        <li key={p.id}>
                          <div className="flex items-center gap-2.5 rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2 shadow-xs">
                            <Avatar name={p.name} url={p.avatarUrl} size={30} />
                            <div className="text-left">
                              <div className="text-xs font-bold text-slate-900">{p.name}</div>
                              <div className="text-[11px] font-medium text-blue-600">{p.roleTitle}</div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </li>
      </ul>
    </div>
  );
}
