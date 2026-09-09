import React, { useEffect, useState } from 'react';
import { Table2, KeyRound, ChevronRight } from 'lucide-react';
import { getPerfSchema } from '../api';

/**
 * Schema and index reference, read live from the Postgres catalog.
 *
 * Without this the SQL console is unusable by anyone who did not write the
 * schema: no column names, and no way to reason about why a query did or did
 * not use an index.
 */
export default function SchemaBrowser({ onInsert }) {
  const [schema, setSchema] = useState(null);
  const [open, setOpen] = useState('orders');

  useEffect(() => { getPerfSchema().then(setSchema).catch(() => {}); }, []);

  if (!schema) {
    return <p className="text-[11px] text-neutral-500">Loading schema…</p>;
  }

  return (
    <div className="space-y-1.5">
      {schema.tables.map((t) => {
        const expanded = open === t.table;
        return (
          <div key={t.table} className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <button
              onClick={() => setOpen(expanded ? null : t.table)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 transition-colors"
            >
              <ChevronRight size={12} className={`shrink-0 text-neutral-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
              <Table2 size={13} className="shrink-0 text-[#ef4d23]" />
              <span className="font-mono text-[12px] font-medium text-neutral-900">{t.table}</span>
              <span className="ml-auto text-[10px] text-neutral-500 tabular-nums">
                {t.rows.toLocaleString()} rows · {t.size}
              </span>
            </button>

            {expanded && (
              <div className="border-t border-neutral-100 px-3 py-2.5 space-y-3">
                <div className="flex flex-wrap gap-1">
                  {t.columns.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => onInsert?.(c.name)}
                      title={`${c.type}${c.nullable ? ' · nullable' : ' · not null'}`}
                      className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10.5px] text-neutral-700 hover:border-[#ef4d23]/50 hover:text-[#ef4d23] transition-colors"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                {t.indexes.length > 0 && (
                  <div>
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Indexes</p>
                    <div className="space-y-1">
                      {t.indexes.map((i) => (
                        <div key={i.name} className="flex items-start gap-1.5 text-[10.5px]">
                          <KeyRound size={10} className="shrink-0 mt-0.5 text-neutral-400" />
                          <span className="font-mono text-neutral-700 break-all">
                            {i.on}
                            {i.unique && <span className="ml-1 text-[9px] uppercase text-emerald-700">unique</span>}
                          </span>
                          <span className="ml-auto shrink-0 text-neutral-400 tabular-nums">{i.size}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
