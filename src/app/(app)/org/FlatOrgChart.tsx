export type FlatPerson = { id: string; name: string; roleTitle: string };
export type FlatDept = { id: string; name: string; people: FlatPerson[] };
export type FlatOrgData = { root: FlatPerson | null; departments: FlatDept[] };

function Box({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "root" | "dept" | "person";
}) {
  const toneClass =
    tone === "root"
      ? "border-blue-400 bg-white px-6 py-3 text-base font-bold uppercase tracking-wide text-blue-700 shadow-sm"
      : tone === "dept"
        ? "border-blue-300 bg-white px-5 py-2.5 text-sm font-bold capitalize text-blue-700 shadow-sm"
        : "border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-600 shadow-sm";
  return <div className={`whitespace-nowrap rounded-xl border-2 ${toneClass}`}>{children}</div>;
}

export default function FlatOrgChart({ data }: { data: FlatOrgData }) {
  if (!data.root) {
    return <p className="py-8 text-center text-sm text-slate-400">No org data yet.</p>;
  }
  return (
    <div className="overflow-x-auto py-2">
      <ul className="org-tree min-w-max">
        <li>
          <Box tone="root">{data.root.name}</Box>
          {data.departments.length > 0 && (
            <ul>
              {data.departments.map((d) => (
                <li key={d.id}>
                  <Box tone="dept">{d.name}</Box>
                  {d.people.length > 0 && (
                    <ul>
                      {d.people.map((p) => (
                        <li key={p.id}>
                          <Box tone="person">
                            <div className="font-semibold">{p.name}</div>
                            <div className="font-normal normal-case text-blue-400">{p.roleTitle}</div>
                          </Box>
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
