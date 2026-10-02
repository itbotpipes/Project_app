"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, Users, Building2, Shield, FileText, Sparkles, ArrowRight, CornerDownLeft } from "lucide-react";
import Avatar from "../_components/Avatar";

export interface SearchableItem {
  id: string;
  type: "person" | "department" | "role" | "kpi" | "template";
  title: string;
  subtitle: string;
  tag?: string;
  avatarUrl?: string | null;
  elementId?: string; // HTML ID to scroll to
  link?: string;
}

interface AdminQuickSearchProps {
  items: SearchableItem[];
}

export default function AdminQuickSearch({ items }: AdminQuickSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener: Ctrl+K or Cmd+K or "/"
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Filter items
  const filteredResults = useMemo(() => {
    let list = items;
    if (selectedCategory !== "all") {
      list = list.filter((item) => item.type === selectedCategory);
    }
    if (!query.trim()) {
      return list.slice(0, 12);
    }
    const q = query.toLowerCase();
    return list
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.tag?.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [items, query, selectedCategory]);

  function handleSelect(item: SearchableItem) {
    setIsOpen(false);
    if (item.link) {
      window.location.href = item.link;
      return;
    }
    if (item.elementId) {
      const el = document.getElementById(item.elementId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-blue-500", "transition-all");
        setTimeout(() => el.classList.remove("ring-2", "ring-blue-500"), 2500);
      }
    }
  }

  // Keyboard navigation within list
  function handleListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredResults.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % Math.max(1, filteredResults.length));
    } else if (e.key === "Enter" && filteredResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredResults[selectedIndex]);
    }
  }

  return (
    <>
      {/* Search Button in Header */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group flex items-center justify-between gap-3 w-full sm:w-80 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-500 shadow-sm hover:border-blue-300 hover:bg-slate-50 transition-all"
        title="Search Admin Panel (Ctrl+K)"
      >
        <div className="flex items-center gap-2">
          <Search size={14} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
          <span className="font-medium text-slate-600 group-hover:text-slate-900">
            Quick search admin...
          </span>
        </div>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
          ⌘K
        </kbd>
      </button>

      {/* Quick Access Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-16 sm:pt-24 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-scale"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="flex items-center border-b border-slate-100 px-4 py-3">
              <Search size={18} className="text-blue-600 shrink-0 mr-3" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleListKeyDown}
                placeholder="Type to search people, departments, roles, KPI templates..."
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
              />
              {query ? (
                <button
                  onClick={() => setQuery("")}
                  className="rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              ) : (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  ESC to close
                </span>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs">
              {[
                { id: "all", label: "All", icon: Sparkles },
                { id: "person", label: "People", icon: Users },
                { id: "department", label: "Departments", icon: Building2 },
                { id: "role", label: "Roles", icon: Shield },
                { id: "kpi", label: "KPIs", icon: FileText },
              ].map((cat) => {
                const Icon = cat.icon;
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSelectedIndex(0);
                    }}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium transition-all ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-200/70"
                    }`}
                  >
                    <Icon size={12} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto p-2">
              {filteredResults.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No matching results found for &ldquo;{query}&rdquo;.
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredResults.map((item, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs cursor-pointer transition-colors ${
                          isSelected ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {item.type === "person" ? (
                            <Avatar name={item.title} url={item.avatarUrl} size={28} />
                          ) : (
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                                item.type === "department"
                                  ? "bg-blue-100 text-blue-700"
                                  : item.type === "role"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {item.type === "department" && <Building2 size={14} />}
                              {item.type === "role" && <Shield size={14} />}
                              {item.type === "kpi" && <FileText size={14} />}
                              {item.type === "template" && <Sparkles size={14} />}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-semibold text-slate-900">{item.title}</span>
                              {item.tag && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-600">
                                  {item.tag}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">{item.subtitle}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 pl-2">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] uppercase font-semibold text-slate-500">
                            {item.type}
                          </span>
                          {isSelected && <CornerDownLeft size={13} className="text-blue-600" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <span>Navigate with <kbd className="font-mono font-semibold text-slate-600">↑</kbd> <kbd className="font-mono font-semibold text-slate-600">↓</kbd></span>
                <span>•</span>
                <span>Select with <kbd className="font-mono font-semibold text-slate-600">↵</kbd></span>
              </div>
              <span>{filteredResults.length} results</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
